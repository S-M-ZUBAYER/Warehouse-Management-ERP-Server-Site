'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const { once } = require('node:events');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const dependencyRequire = createRequire(path.join(process.env.ROLE_FIX_DEPENDENCY_ROOT || root, 'package.json'));

function loadModule(relativePath, overrides = {}) {
  const filename = path.join(root, relativePath);
  const module = { exports: {} };
  const localRequire = (id) => {
    if (Object.hasOwn(overrides, id)) return overrides[id];
    if (id.startsWith('.')) {
      const target = path.relative(root, path.resolve(path.dirname(filename), `${id}.js`));
      return loadModule(target, overrides);
    }
    return dependencyRequire(id);
  };
  // Mock external dependencies without starting Redis, the database, or business actions.
  const wrapper = vm.runInThisContext(`(function(require, module, exports) {\n${fs.readFileSync(filename, 'utf8')}\n})`, { filename });
  wrapper(localRequire, module, module.exports);
  return module.exports;
}

const permissions = loadModule('utils/permissions.js');
const orderPermissions = loadModule('utils/orderPermissions.js');

function userWithPermissions(...keys) {
  const user = { role: 'Manager', companyId: 1, userId: 2, permissions: {} };
  for (const key of keys) {
    let node = user.permissions;
    const parts = permissions.permissionPathMap[key];
    parts.forEach((part, index) => {
      if (index === parts.length - 1) node[part] = true;
      else {
        node[part] ||= { access: true, sub: {} };
        node = node[part].sub;
      }
    });
  }
  return user;
}

test('role create, edit and permission updates preserve selected Return Order and unrelated selections', async () => {
  let created;
  let updated;
  const existingRole = { name: 'Manager', update: async (data) => { updated = data; }, reload: async () => existingRole };
  const service = loadModule('modules/roles/roles.service.js', {
    '../../config/database': { sequelize: {} },
    '../../config/redis': { flushByPattern: async () => {} },
    '../../models': { Role: {
      findOne: async ({ where }) => where.id ? existingRole : null,
      create: async (data) => { created = data; return data; },
    } },
  });
  const owner = { role: 'owner', companyId: 1 };
  const supplied = userWithPermissions('return_order', 'outbound_order', 'platform_manual_order').permissions;
  const original = structuredClone(supplied);
  await service.createRole(owner, { name: 'Return Manager', permissions: supplied });
  await service.updateRole(owner, 2, { permissions: supplied });
  assert.deepEqual(supplied, original);
  for (const saved of [created.permissions, updated.permissions]) {
    for (const key of ['return_order', 'outbound_order', 'platform_manual_order']) {
      assert.equal(permissions.hasPermissionPath(saved, key), true, key);
    }
    assert.equal(permissions.hasPermissionPath(saved, 'inbound'), false);
    assert.equal(saved.dashboard.access, true);
    assert.equal(saved.contact.access, true);
  }
  supplied.order_management.sub.order_processing.sub.return_order = false;
  await service.updatePermissions(owner, 2, supplied);
  assert.equal(permissions.hasPermissionPath(updated.permissions, 'return_order'), false);
  assert.equal(permissions.hasPermissionPath(updated.permissions, 'outbound_order'), true);
  assert.equal(original.order_management.sub.order_processing.sub.return_order, true);

  const template = service.getPermissionTemplate();
  const templateKeys = [];
  const visit = (nodes) => nodes.forEach((node) => { templateKeys.push(node.key); if (node.sub) visit(node.sub); });
  visit(template.pages);
  const expectedKeys = new Set([...Object.keys(permissions.permissionPathMap), ...Object.keys(template.defaultPermissions)]);
  assert.deepEqual(templateKeys.sort(), [...expectedKeys].sort());
  await assert.rejects(service.createRole(userWithPermissions('role_management'), { name: 'Denied' }), { statusCode: 403 });
  await assert.rejects(service.updateRole(userWithPermissions('role_management'), 2, {}), { statusCode: 403 });
  await assert.rejects(service.updatePermissions(userWithPermissions('role_management'), 2, {}), { statusCode: 403 });
});

test('any-page checks require an actual child permission and preserve owner access', () => {
  const run = (middleware, user) => {
    let status = 200;
    const res = { status(code) { status = code; return this; }, json() {} };
    middleware({ user }, res, () => {});
    return status;
  };
  assert.equal(run(orderPermissions.requireOrderReadAccess, undefined), 401);
  assert.equal(run(orderPermissions.requireOrderReadAccess, userWithPermissions('order_processing')), 403);
  assert.equal(run(orderPermissions.requireOrderReadAccess, { role: 'owner' }), 200);
  for (const key of orderPermissions.ORDER_PAGE_PERMISSIONS) {
    assert.equal(run(orderPermissions.requireOrderReadAccess, userWithPermissions(key)), 200, key);
    assert.equal(run(orderPermissions.requireOrderPackAccess, userWithPermissions(key)), ['new_order', 'processed_order'].includes(key) ? 200 : 403, key);
  }
});

test('mounted order routes allow their callers and deny unauthorized requests before business handlers', async (t) => {
  const express = dependencyRequire('express');
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    const role = req.headers['x-test-role'];
    if (role) req.user = role === 'owner' ? { role: 'owner', companyId: 1 } : userWithPermissions(...role.split(','));
    next();
  });
  const controller = new Proxy({}, { get: (_, name) => (req, res) => res.json({ handler: name }) });
  const overrides = {
    '../../middlewares/auth': { requireRole: (role) => (req, res, next) => req.user?.role === role ? next() : res.status(403).json({ denied: true }) },
    '../../utils/response': { sendError: (res, message, status) => res.status(status).json({ message }) },
  };
  for (const name of ['packFailedOrders', 'pushSuccessfulOrders', 'withdrawOrders', 'orderActivityLogs', 'manualOrders']) {
    overrides[`./${name}.controller`] = controller;
    const router = loadModule(`modules/${name}/${name}.routes.js`, overrides);
    app.use('/order-management', router);
    if (router.publicRouter) app.use('/platform-order-activity', router.publicRouter);
  }
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const request = async (role, method, url, expected) => {
    const res = await fetch(base + url, {
      method,
      headers: { ...(role ? { 'x-test-role': role } : {}), 'Content-Type': 'application/json', Connection: 'close' },
      ...(method !== 'GET' ? { body: '{}' } : {}),
    });
    await res.text();
    assert.equal(res.status, expected, `${role || 'anonymous'} ${method} ${url}`);
  };
  const prefix = '/order-management';
  for (const url of ['/manual-orders', '/withdraw-orders', '/pack-failed-orders', '/push-successful-orders', '/platform-orders/tiktok/123/activity-logs']) {
    await request(undefined, 'GET', prefix + url, 401);
    await request('outbound_order', 'GET', prefix + url, 403);
    await request('owner', 'GET', prefix + url, 200);
  }
  for (const key of orderPermissions.ORDER_PAGE_PERMISSIONS) {
    for (const url of ['/withdraw-orders', '/pack-failed-orders', '/push-successful-orders', '/platform-orders/tiktok/123/activity-logs']) {
      await request(key, 'GET', prefix + url, 200);
    }
    await request(key, 'POST', `${prefix}/platform-orders/activity-logs`, 200);
    await request(key, 'POST', `${prefix}/platform-orders/activity-logs/bulk`, 200);
  }
  for (const key of ['new_order', 'processed_order']) {
    await request(key, 'GET', `${prefix}/manual-orders/sku-search?warehouseId=1`, 200);
    await request(key, 'GET', `${prefix}/manual-orders`, 403);
    for (const url of ['/platform-orders/change-sku-mapping', '/platform-orders/pack-stock', '/pack-failed-orders', '/push-successful-orders']) {
      await request(key, 'POST', prefix + url, 200);
    }
    await request(key, 'DELETE', `${prefix}/withdraw-orders`, 200);
    await request(key, 'DELETE', `${prefix}/pack-failed-orders`, 200);
  }
  await request('new_order', 'POST', `${prefix}/withdraw-orders`, 403);
  await request('processed_order', 'POST', `${prefix}/withdraw-orders`, 200);
  for (const key of ['manual_order', 'platform_manual_order', 'all_order', 'completed_order']) {
    await request(key, 'POST', `${prefix}/platform-orders/change-sku-mapping`, 403);
    await request(key, 'POST', `${prefix}/platform-orders/pack-stock`, 403);
    await request(key, 'POST', `${prefix}/withdraw-orders`, 403);
  }
  for (const key of ['manual_order', 'platform_manual_order']) {
    await request(key, 'GET', `${prefix}/manual-orders/sku-search?warehouseId=1`, 200);
  }
  for (const url of ['/manual-orders', '/manual-orders/dropdowns', '/manual-orders/123', '/manual-orders/aftership/config']) {
    await request('manual_order', 'GET', prefix + url, 200);
    await request('platform_manual_order', 'GET', prefix + url, 403);
  }
  await request('manual_order', 'POST', `${prefix}/manual-orders`, 200);
  await request('manual_order', 'POST', `${prefix}/manual-orders/shipping-wallet/checkout`, 403);
  await request('owner', 'POST', `${prefix}/manual-orders/shipping-wallet/checkout`, 200);
  const previousKey = process.env.ORDER_WEBHOOK_API_KEY;
  try {
    delete process.env.ORDER_WEBHOOK_API_KEY;
    await request(undefined, 'POST', '/platform-order-activity/activity-logs', 200);
    process.env.ORDER_WEBHOOK_API_KEY = 'test-only-key';
    await request(undefined, 'POST', '/platform-order-activity/activity-logs', 401);
  } finally {
    if (previousKey === undefined) delete process.env.ORDER_WEBHOOK_API_KEY;
    else process.env.ORDER_WEBHOOK_API_KEY = previousKey;
  }
});
