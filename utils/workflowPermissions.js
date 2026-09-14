'use strict';

const { requireAnyPageAccess, requirePageAccess } = require('./permissions');
const { ORDER_PAGE_PERMISSIONS } = require('./orderPermissions');

const WAREHOUSE_LOOKUP_PAGES = [
  'warehouse_management', 'product_list', 'merchant_sku', 'combine_sku',
  'sku_mapping', 'inventory_list', 'inventory_log', 'manual_inbound',
  'inbound', 'outbound_order', 'manual_order', 'platform_manual_order',
  'sub_account', ...ORDER_PAGE_PERMISSIONS,
];

// Only these shared operations accept another page's permission. All other
// methods/paths retain the module's original guard, including owner-only routes.
const dependencies = {
  warehouse_management: [
    ['GET', /^\/$/, WAREHOUSE_LOOKUP_PAGES],
  ],
  merchant_sku: [
    ['GET', /^\/(?:dropdowns|\d+)?$/, ['product_list']],
    ['POST', /^\/$/, ['product_list']],
    ['PUT', /^\/\d+$/, ['product_list']],
    ['DELETE', /^\/\d+$/, ['product_list']],
    ['DELETE', /^\/bulk$/, ['product_list', 'inventory_list']],
  ],
  inventory_list: [
    ['GET', /^\/$/, ['product_list']],
    ['PUT', /^\/stock-alert$/, ['product_list']],
  ],
  stock: [
    ['GET', /^\/merchant\/\d+$/, ORDER_PAGE_PERMISSIONS],
    ['GET', /^\/ledger$/, ['inventory_log']],
  ],
  inbound: [
    ['GET', /^\/(?:dropdowns|picker|manual)$/, ['manual_inbound']],
    ['GET', /^\/picker$/, ['return_order']],
    ['POST', /^\/manual$/, ['manual_inbound']],
  ],
  platform_stores: [
    // Dashboard, sidebar plans and chat need the assigned store list at login.
    ['GET', /^\/$/, ['dashboard']],
  ],
  role_management: [
    ['GET', /^\/$/, ['sub_account']],
  ],
  sku_mapping: [
    // AppShell initializes these scoped dropdowns for every signed-in user.
    ['GET', /^\/dropdowns$/, ['dashboard']],
    ['GET', /^\/by-merchant$/, ORDER_PAGE_PERMISSIONS],
  ],
};

const requireWorkflowAccess = (moduleKey, defaultPermission = moduleKey) => (req, res, next) => {
  const path = req.path.replace(/\/+$/, '') || '/';
  const permissionKeys = [defaultPermission];
  for (const [method, pattern, pages] of dependencies[moduleKey] || []) {
    if (req.method === method && pattern.test(path)) permissionKeys.push(...pages);
  }
  if (permissionKeys.length === 1) return requirePageAccess(defaultPermission)(req, res, next);
  return requireAnyPageAccess([...new Set(permissionKeys)])(req, res, next);
};

module.exports = { requireWorkflowAccess };
