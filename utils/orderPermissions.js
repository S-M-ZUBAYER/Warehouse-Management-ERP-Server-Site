'use strict';

const { requireAnyPageAccess } = require('./permissions');

const ORDER_PAGE_PERMISSIONS = [
  'new_order', 'processed_order', 'to_pickup_order', 'shipped_order',
  'completed_order', 'all_order', 'return_order', 'canceled_order',
];

// All order lists read the shared tracking lists; packing and SKU edits live on these two pages.
const ORDER_PACK_PERMISSIONS = ['new_order', 'processed_order'];

module.exports = {
  ORDER_PAGE_PERMISSIONS,
  requireOrderReadAccess: requireAnyPageAccess(ORDER_PAGE_PERMISSIONS),
  requireOrderPackAccess: requireAnyPageAccess(ORDER_PACK_PERMISSIONS),
  requireOrderSkuSearchAccess: requireAnyPageAccess([
    ...ORDER_PACK_PERMISSIONS, 'manual_order', 'platform_manual_order',
  ]),
};
