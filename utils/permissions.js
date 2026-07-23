'use strict';

const parsePermissions = (permissions) => {
  if (!permissions) return {};
  if (typeof permissions === 'string') {
    try { return JSON.parse(permissions); } catch (_) { return {}; }
  }
  return permissions || {};
};

const isOwner = (user) => String(user?.role || '').toLowerCase() === 'owner' || user?.is_owner === true || user?.isOwner === true;

const permissionPathMap = {
  dashboard: ['dashboard'],
  product_list: ['product_management', 'product_list'],
  combine_sku: ['product_management', 'combine_sku'],
  merchant_sku: ['inventory_management', 'merchant_sku'],
  sku_mapping: ['inventory_management', 'sku_mapping'],
  sku_mapping_by_product: ['inventory_management', 'sku_mapping', 'sku_mapping_by_product'],
  sku_mapping_by_merchant: ['inventory_management', 'sku_mapping', 'sku_mapping_by_merchant'],
  inventory_list: ['inventory_management', 'inventory_list'],
  manual_inbound: ['inventory_management', 'manual_inbound'],
  inbound: ['inventory_management', 'inbound'],
  inbound_draft: ['inventory_management', 'inbound', 'inbound_draft'],
  inbound_on_the_way: ['inventory_management', 'inbound', 'inbound_on_the_way'],
  inbound_complete: ['inventory_management', 'inbound', 'inbound_complete'],
  outbound_order: ['inventory_management', 'outbound_order'],
  inventory_log: ['inventory_management', 'inventory_log'],
  order_management: ['order_management'],
  order_processing: ['order_management', 'order_processing'],
  new_order: ['order_management', 'order_processing', 'new_order'],
  processed_order: ['order_management', 'order_processing', 'processed_order'],
  to_pickup_order: ['order_management', 'order_processing', 'to_pickup_order'],
  shipped_order: ['order_management', 'order_processing', 'shipped_order'],
  completed_order: ['order_management', 'order_processing', 'completed_order'],
  all_order: ['order_management', 'order_processing', 'all_order'],
  canceled_order: ['order_management', 'order_processing', 'canceled_order'],
  manual_order: ['order_management', 'manual_order'],
  warehouse_management: ['warehouse_management'],
  store_authorization: ['system_configuration', 'store_authorization'],
  account_management: ['system_configuration', 'account_management'],
  sub_account: ['system_configuration', 'account_management', 'sub_account'],
  role_management: ['system_configuration', 'account_management', 'role_management'],
};

const hasPermissionPath = (permissionsInput, pathOrKey) => {
  const permissions = parsePermissions(permissionsInput);
  const path = Array.isArray(pathOrKey) ? pathOrKey : (permissionPathMap[pathOrKey] || [pathOrKey]);
  if (!path.length) return true;

  let node = permissions[path[0]];
  if (node === true) return path.length === 1;
  if (!node) return false;
  if (typeof node === 'object' && node.access !== true) return false;
  if (path.length === 1) return typeof node === 'object' ? node.access === true : node === true;

  for (let i = 1; i < path.length; i += 1) {
    const key = path[i];
    node = node?.sub?.[key];
    if (node === true) return i === path.length - 1;
    if (!node) return false;
    if (typeof node === 'object') {
      if (node.access !== true) return false;
      if (i === path.length - 1) return true;
    }
  }
  return true;
};

const requirePageAccess = (permissionKey) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ success: false, message: 'Unauthenticated' });
  if (isOwner(req.user)) return next();
  if (hasPermissionPath(req.user.permissions, permissionKey)) return next();
  return res.status(403).json({
    success: false,
    message: 'Access denied. You do not have permission for this page.',
    requiredPermission: permissionKey,
  });
};

const getPermittedStoreIds = async (user, { canEdit = false } = {}) => {
  if (isOwner(user)) return null;
  const { UserStorePermission } = require('../models');
  const where = {
    company_id: user.companyId,
    user_id: user.userId,
    can_view: true,
  };
  if (canEdit) where.can_edit = true;
  const rows = await UserStorePermission.findAll({ where, attributes: ['connection_id'], raw: true });
  return rows.map((row) => Number(row.connection_id)).filter(Boolean);
};

const hasStorePermission = async (user, storeId, { canEdit = false } = {}) => {
  if (isOwner(user)) return true;
  const { UserStorePermission } = require('../models');
  const where = {
    company_id: user.companyId,
    user_id: user.userId,
    connection_id: Number(storeId),
    can_view: true,
  };
  if (canEdit) where.can_edit = true;
  const count = await UserStorePermission.count({ where });
  return count > 0;
};

const assertStorePermission = async (user, storeId, options = {}) => {
  const allowed = await hasStorePermission(user, storeId, options);
  if (!allowed) {
    const err = new Error(options.canEdit
      ? 'You do not have work/edit permission for this store'
      : 'You do not have access to this store');
    err.statusCode = 403;
    throw err;
  }
};

module.exports = {
  parsePermissions,
  isOwner,
  permissionPathMap,
  hasPermissionPath,
  requirePageAccess,
  getPermittedStoreIds,
  hasStorePermission,
  assertStorePermission,
};
