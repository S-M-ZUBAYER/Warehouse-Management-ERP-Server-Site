'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const { once } = require('node:events');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const sourceRoot = process.env.ROLE_FIX_SOURCE_ROOT || root;
const dependencyRequire = createRequire(path.join(sourceRoot, 'package.json'));
const { Op } = dependencyRequire('sequelize');

function loadModule(relativePath, overrides = {}, cache = new Map()) {
  const key = relativePath.replaceAll('\\', '/');
  if (Object.hasOwn(overrides, key)) return overrides[key];
  if (cache.has(key)) return cache.get(key).exports;
  const staged = path.join(root, key);
  const filename = fs.existsSync(staged) ? staged : path.join(sourceRoot, key);
  const module = { exports: {} };
  cache.set(key, module);
  const localRequire = (id) => {
    if (!id.startsWith('.')) return dependencyRequire(id);
    let target = path.posix.normalize(path.posix.join(path.posix.dirname(key), id));
    if (!target.endsWith('.js')) target += '.js';
    return loadModule(target, overrides, cache);
  };
  const wrapper = vm.runInThisContext(`(function(require, module, exports) {\n${fs.readFileSync(filename, 'utf8')}\n})`, { filename });
  wrapper(localRequire, module, module.exports);
  return module.exports;
}

const permissions = loadModule('utils/permissions.js');
function userWithPages(...keys) {
  const user = { role: 'custom order operator', companyId: 1, userId: 2, permissions: {} };
  for (const key of keys) {
    let node = user.permissions;
    permissions.permissionPathMap[key].forEach((part, index, parts) => {
      if (index === parts.length - 1) node[part] = true;
      else {
        node[part] ||= { access: true, sub: {} };
        node = node[part].sub;
      }
    });
  }
  return user;
}

test('mounted API dependencies work for isolated page permissions and retain denied actions', async (t) => {
  const express = dependencyRequire('express');
  const controller = new Proxy({}, { get: (_, name) => (req, res) => res.json({ handler: name }) });
  const names = ['warehouses', 'merchantSkus', 'inventory', 'stock', 'inbound', 'outbound',
    'platformStores', 'skuMapping', 'packFailedOrders', 'pushSuccessfulOrders', 'withdrawOrders',
    'orderActivityLogs', 'manualOrders', 'roles', 'users', 'Pages', 'subscription'];
  const overrides = {
    'config/redis.js': {},
    'config/rateLimiter.js': { apiLimiter: (req, res, next) => next() },
    'modules/platformManualOrders/platformManualOrders.controller.js': controller,
    'modules/skuMapping/skuMapping.service.js': new Proxy({}, {
      get: () => async () => ({ data: [], pagination: {}, message: 'test' }),
    }),
  };
  for (const name of names) overrides[`modules/${name}/${name}.controller.js`] = controller;
  for (const name of ['auth', 'adminManagement', 'dashboard', 'combineskus', 'autoOrderAccept',
    'platformManualOrders', 'returnOrders', 'platformOrderDeductions', 'platformProducts',
    'platformSkuMappings', 'skuSyncGroup']) {
    overrides[`modules/${name}/${name}.routes.js`] = express.Router();
  }
  overrides['modules/subscription/pricing.routes.js'] = express.Router();
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    const pages = req.headers['x-test-pages'];
    if (pages) req.user = pages === 'owner' ? { role: 'owner', companyId: 1 } : userWithPages(...pages.split(','));
    next();
  });
  app.use('/api/v1', loadModule('routes/index.js', overrides));
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}/api/v1`;
  const request = async (pages, method, url, status) => {
    const response = await fetch(base + url, {
      method, headers: { ...(pages ? { 'x-test-pages': pages } : {}), 'Content-Type': 'application/json', Connection: 'close' },
      ...(method !== 'GET' ? { body: '{}' } : {}),
    });
    const body = await response.text();
    assert.equal(response.status, status, `${pages || 'anonymous'} ${method} ${url}: ${body}`);
  };
  const allowed = [
    ['new_order', 'GET', '/stock/merchant/75'],
    ['new_order', 'GET', '/warehouses?limit=100'],
    ['processed_order', 'GET', '/warehouses?limit=100'],
    ['new_order', 'GET', '/sku-mapping/by-merchant?search=SKU1'],
    ['processed_order', 'GET', '/sku-mapping/by-merchant?platformStoreId=1'],
    ['new_order', 'GET', '/order-management/manual-orders/sku-search?warehouseId=10'],
    ['processed_order', 'POST', '/order-management/platform-orders/change-sku-mapping'],
    ['new_order', 'POST', '/order-management/platform-orders/pack-stock'],
    ['manual_inbound', 'GET', '/inbound/manual'],
    ['manual_inbound', 'GET', '/inbound/dropdowns'],
    ['manual_inbound', 'GET', '/inbound/picker?warehouseId=10'],
    ['manual_inbound', 'POST', '/inbound/manual'],
    ['manual_inbound', 'GET', '/warehouses'],
    ['inbound_on_the_way', 'PUT', '/inbound/1/receive'],
    ['outbound_order', 'PUT', '/outbound/1/receive'],
    ['outbound_order', 'GET', '/warehouses'],
    ['return_order', 'GET', '/inbound/picker'],
    ['return_order', 'GET', '/warehouses'],
    ['inventory_log', 'GET', '/stock/ledger'],
    ['inventory_log', 'GET', '/warehouses'],
    ['combine_sku', 'GET', '/warehouses'],
    ['merchant_sku', 'GET', '/warehouses'],
    ['sku_mapping_by_product', 'GET', '/warehouses'],
    ['product_list', 'GET', '/merchant-skus'],
    ['product_list', 'GET', '/merchant-skus/dropdowns'],
    ['product_list', 'GET', '/merchant-skus/75'],
    ['product_list', 'POST', '/merchant-skus'],
    ['product_list', 'PUT', '/merchant-skus/75'],
    ['product_list', 'DELETE', '/merchant-skus/75'],
    ['product_list', 'DELETE', '/merchant-skus/bulk'],
    ['product_list', 'GET', '/inventory'],
    ['product_list', 'PUT', '/inventory/stock-alert'],
    ['product_list', 'GET', '/warehouses'],
    ['inventory_list', 'DELETE', '/merchant-skus/bulk'],
    ['sub_account', 'GET', '/roles'],
    ['dashboard', 'GET', '/platform-stores'],
    ['dashboard', 'GET', '/order-management/platform-stores'],
    ['dashboard', 'GET', '/sku-mapping/dropdowns'],
  ];
  for (const args of allowed) {
    await request(...args, 200);
    await request('owner', args[1], args[2], 200);
    await request(undefined, args[1], args[2], 401);
  }
  const denied = [
    ['dashboard', 'GET', '/stock/merchant/75'],
    ['dashboard', 'GET', '/warehouses'],
    ['new_order', 'GET', '/inventory'],
    ['new_order', 'POST', '/stock/adjust'],
    ['new_order', 'POST', '/stock/deduct'],
    ['new_order', 'POST', '/stock/bulk'],
    ['new_order', 'POST', '/warehouses'],
    ['new_order', 'PUT', '/warehouses/10'],
    ['new_order', 'DELETE', '/warehouses/10'],
    ['new_order', 'PATCH', '/warehouses/10/set-default'],
    ['new_order', 'POST', '/sku-mapping/mapping'],
    ['new_order', 'DELETE', '/sku-mapping/mapping/1'],
    ['new_order', 'POST', '/sku-mapping/sync-mapped'],
    ['new_order', 'GET', '/sku-mapping/by-merchant/counts'],
    ['new_order', 'GET', '/platform-stores/1'],
    ['new_order', 'GET', '/order-management/manual-orders'],
    ['manual_inbound', 'GET', '/inbound'],
    ['manual_inbound', 'PUT', '/inbound/1/receive'],
    ['return_order', 'POST', '/inbound/manual'],
    ['inventory_log', 'POST', '/stock/deduct'],
    ['product_list', 'PUT', '/inventory/75/stock'],
    ['inventory_list', 'POST', '/merchant-skus'],
    ['store_authorization', 'PUT', '/platform-stores/1/permissions'],
    ['store_authorization', 'PUT', '/platform-stores/1'],
    ['store_authorization', 'DELETE', '/platform-stores/1'],
    ['role_management', 'POST', '/roles'],
    ['sub_account', 'POST', '/roles'],
    ['sub_account', 'PATCH', '/roles/1/permissions'],
    ['sub_account', 'POST', '/users'],
    ['inventory_list', 'POST', '/stock/adjust'],
    ['manual_order', 'POST', '/order-management/manual-orders/shipping-wallet/checkout'],
  ];
  for (const args of denied) await request(...args, 403);
});

const matches = (row, where = {}) => Reflect.ownKeys(where).every((key) => {
  const value = where[key];
  if (key === Op.and) return value.every((condition) => matches(row, condition));
  if (key === Op.or) return value.some((condition) => matches(row, condition));
  if (value && typeof value === 'object') {
    if (Object.hasOwn(value, Op.in)) return value[Op.in].map(String).includes(String(row[key]));
    if (Object.hasOwn(value, Op.notIn)) return !value[Op.notIn].map(String).includes(String(row[key]));
  }
  return String(row[key]) === String(value);
});

function scopedModels({ canEdit = true, warehouseIds = [10] } = {}) {
  return {
    UserWarehousePermission: {
      findAll: async ({ where }) => where.company_id === 1 && where.user_id === 2 && (!where.can_edit || canEdit)
        ? warehouseIds.map((warehouse_id) => ({ warehouse_id })) : [],
      count: async ({ where }) => where.company_id === 1 && where.user_id === 2
        && warehouseIds.includes(where.warehouse_id) && (!where.can_edit || canEdit) ? 1 : 0,
    },
    UserStorePermission: {
      findAll: async () => [{ connection_id: 3 }],
      count: async ({ where }) => where.connection_id === 3 ? 1 : 0,
    },
  };
}

const isolated = (models, extra = {}) => ({
  'models.js': models,
  'config/redis.js': { flushByPattern: async () => {}, get: async () => null, set: async () => {} },
  'config/database.js': { sequelize: {} },
  'modules/skuSyncGroup/skuSyncGroup.service.js': {},
  'modules/shared/sellableSkuStock.js': {},
  ...extra,
});

test('merchant stock totals include only assigned warehouses and the authenticated company', async () => {
  const rows = [
    { company_id: 1, merchant_sku_id: 75, warehouse_id: 10, qty_on_hand: 8, qty_reserved: 2, qty_inbound: 1 },
    { company_id: 1, merchant_sku_id: 75, warehouse_id: 20, qty_on_hand: 100, qty_reserved: 0, qty_inbound: 0 },
    { company_id: 2, merchant_sku_id: 75, warehouse_id: 10, qty_on_hand: 900, qty_reserved: 0, qty_inbound: 0 },
  ];
  for (const warehouseIds of [[10], []]) {
    const models = {
      ...scopedModels({ warehouseIds }),
      MerchantSku: { findOne: async ({ where }) => where.company_id === 1 ? { id: 75 } : null },
      SkuWarehouseStock: { findAll: async ({ where }) => rows.filter((row) => matches(row, where)) },
    };
    const service = loadModule('modules/stock/stock.service.js', isolated(models));
    const result = await service.getStockByMerchantSku(userWithPages('new_order'), 75);
    assert.equal(result.totals.qty_available, warehouseIds.length ? 6 : 0);
    assert.deepEqual(result.byWarehouse.map((row) => row.warehouse_id), warehouseIds);
    const owner = await service.getStockByMerchantSku({ role: 'owner', companyId: 1 }, 75);
    assert.equal(owner.totals.qty_available, 106);
    await assert.rejects(service.getStockByMerchantSku({ role: 'owner', companyId: 2 }, 75), { statusCode: 404 });
  }
});

test('inbound and outbound mutations require work access to the order warehouse', async () => {
  for (const moduleName of ['inbound', 'outbound']) {
    const title = moduleName === 'inbound' ? 'Inbound' : 'Outbound';
    const actions = [`updateDraft${title}`, `ship${title}Order`, `receive${title}Order`,
      moduleName === 'inbound' ? 'cancelInboundOrder' : 'deleteDraftOutbound'];
    for (const action of actions) {
      for (const [canEdit, warehouseId] of [[true, 10], [false, 10], [true, 20]]) {
        const order = { id: 1, company_id: 1, deleted_at: null, warehouse_id: warehouseId,
          status: action.startsWith('receive') ? 'on_the_way' : 'draft', lines: [{ id: 1 }] };
        let transactionReached = false;
        const models = { ...scopedModels({ canEdit }),
          [`${title}Order`]: { findOne: async ({ where }) => matches(order, where) ? order : null } };
        order.destroy = async () => { transactionReached = true; throw new Error('business action reached'); };
        const service = loadModule(`modules/${moduleName}/${moduleName}.service.js`, isolated(models, {
          'config/database.js': { sequelize: { transaction: async () => {
            transactionReached = true;
            throw new Error('business action reached');
          } } },
        }));
        const allowed = canEdit && warehouseId === 10;
        const payload = action.startsWith('receive') ? { lines: [] } : {};
        await assert.rejects(service[action](userWithPages(moduleName === 'inbound' ? 'inbound_on_the_way' : 'outbound_order'), 1, payload),
          allowed ? { message: 'business action reached' } : { statusCode: 404 }, action);
        assert.equal(transactionReached, allowed, action);
      }
    }
  }
});

test('manual inbound and inventory alert reject unassigned and read-only warehouses before writes', async () => {
  for (const [canEdit, warehouseId] of [[false, 10], [true, 20]]) {
    const models = { ...scopedModels({ canEdit }),
      SkuWarehouseStock: { findAll: async () => [{ id: 1, warehouse_id: warehouseId }] } };
    const inbound = loadModule('modules/inbound/inbound.service.js', isolated(models));
    await assert.rejects(inbound.createManualInbound(userWithPages('manual_inbound'), { warehouseId }), { statusCode: 403 });
    const inventory = loadModule('modules/inventory/inventory.service.js', isolated(models));
    await assert.rejects(inventory.setStockAlert(userWithPages('product_list'), { skuIds: [1], minStock: 2 }), { statusCode: 403 });
  }
});

test('warehouse dropdown ignores stale sub-account cache and applies current assignments', async () => {
  let cachedReads = 0;
  const oldList = { data: [{ id: 20 }], pagination: {} };
  const models = { ...scopedModels(), Warehouse: { findAndCountAll: async ({ where }) => {
    assert.equal(where.company_id, 1);
    assert.deepEqual(where.id[Op.in], [10]);
    return { count: 0, rows: [] };
  } } };
  const service = loadModule('modules/warehouses/warehouses.service.js', isolated(models, {
    'config/redis.js': { get: async () => { cachedReads += 1; return JSON.stringify(oldList); } },
  }));
  const result = await service.getWarehouses(userWithPages('new_order'));
  assert.deepEqual(result.data, []);
  assert.equal(cachedReads, 0);
  assert.deepEqual(await service.getWarehouses({ role: 'owner', companyId: 1 }), oldList);
  assert.equal(cachedReads, 1);
});

test('mapping lookup restricts merchant SKUs by warehouse and mappings by assigned store', async () => {
  const models = { ...scopedModels(),
    SkuWarehouseStock: { findAll: async ({ where }) => {
      assert.equal(where.company_id, 1);
      assert.deepEqual(where.warehouse_id[Op.in], [10]);
      return [{ merchant_sku_id: 75 }];
    } },
    MerchantSku: { findAndCountAll: async ({ where, include }) => {
      assert.equal(matches({ id: 75, warehouse_id: 20, company_id: 1, deleted_at: null }, where), true);
      assert.equal(matches({ id: 76, warehouse_id: 10, company_id: 1, deleted_at: null }, where), true);
      assert.equal(matches({ id: 76, warehouse_id: 20, company_id: 1, deleted_at: null }, where), false);
      assert.equal(matches({ id: 75, warehouse_id: 10, company_id: 2, deleted_at: null }, where), false);
      assert.deepEqual(include[0].where.platform_store_id[Op.in], [-1]);
      return { count: 0, rows: [] };
    } },
    PlatformProduct: { rawAttributes: {} },
  };
  const service = loadModule('modules/skuMapping/skuMapping.service.js', isolated(models));
  assert.deepEqual((await service.getMerchantSkuList(userWithPages('new_order'), { platformStoreId: 999 })).data, []);
});

test('shared store list remains company-scoped, assignment-scoped and excludes credentials', async () => {
  const models = { ...scopedModels(), PlatformStore: { findAndCountAll: async ({ where, attributes }) => {
    assert.equal(where.company_id, 1);
    assert.deepEqual(where.id[Op.in], [3]);
    for (const secret of ['access_token', 'refresh_token', 'webhook_secret']) {
      assert.ok(attributes.exclude.includes(secret));
    }
    return { count: 1, rows: [{ id: 3, store_name: 'Assigned store' }] };
  } } };
  const service = loadModule('modules/platformStores/platformStores.service.js', isolated(models, {
    'modules/subscription/subscription.service.js': { appendSubscriptionSnapshots: async (rows) => rows },
  }));
  const result = await service.getPlatformStores(userWithPages('dashboard'), { companyId: 999 });
  assert.deepEqual(result.data.map((store) => store.id), [3]);
});

test('SKU deletion checks all affected warehouses before starting a destructive action', async () => {
  const models = { ...scopedModels(),
    MerchantSku: {
      findOne: async () => ({ id: 75, warehouse_id: 10 }),
      findAll: async () => [{ id: 75, warehouse_id: 10 }],
    },
    SkuWarehouseStock: { findAll: async () => [{ warehouse_id: 10 }, { warehouse_id: 20 }] },
  };
  const service = loadModule('modules/merchantSkus/merchantSkus.service.js', isolated(models));
  await assert.rejects(service.deleteMerchantSku(userWithPages('product_list'), 75), { statusCode: 403 });
  await assert.rejects(service.bulkDeleteMerchantSkus(userWithPages('inventory_list'), [75]), { statusCode: 403 });
});

test('mapping tab counts use the same store and warehouse scope as the list', async () => {
  for (const warehouseIds of [[10], []]) {
    let calls = 0;
    const service = loadModule('modules/skuMapping/skuMapping.service.js', isolated(scopedModels({ warehouseIds }), {
      'config/database.js': { sequelize: { QueryTypes: { SELECT: 'SELECT' }, query: async (sql, { replacements }) => {
        calls += 1;
        assert.deepEqual(replacements, { companyId: 1, storeIds: [3], warehouseIds: [10] });
        assert.match(sql, /psm\.platform_store_id IN \(:storeIds\)/);
        assert.match(sql, /ms\.warehouse_id IN \(:warehouseIds\)/);
        assert.match(sql, /sws\.company_id = :companyId/);
        assert.match(sql, /sws\.warehouse_id IN \(:warehouseIds\)/);
        return [{ all: 2, mapped: 1, unmapped: 1 }];
      } } },
    }));
    const counts = await service.getMerchantSkuCounts(userWithPages('sku_mapping_by_merchant'));
    assert.deepEqual(counts, warehouseIds.length ? { all: 2, mapped: 1, unmapped: 1 } : { all: 0, mapped: 0, unmapped: 0 });
    assert.equal(calls, warehouseIds.length ? 1 : 0);
  }
});
