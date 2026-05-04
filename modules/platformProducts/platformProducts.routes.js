// 'use strict';

// const express = require('express');
// const router  = express.Router();
// const ctrl    = require('./platformProducts.controller');
// const { authenticate, requireRole } = require('../../middlewares/auth');
// const { body, query } = require('express-validator');

// router.use(authenticate);

// // GET /api/v1/platform-products                      - list (ByProduct page table)
// router.get('/', ctrl.getList);

// // GET /api/v1/platform-products/counts               - tab badge counts
// router.get('/counts', ctrl.getCounts);

// // POST /api/v1/platform-products/sync                - Sync Product button
// // ?platformStoreId=1  (optional — omit to sync ALL stores)
// router.post('/sync', requireRole('owner', 'admin', 'manager'), ctrl.syncProducts);

// // POST /api/v1/platform-products/generate-sku        - Generate Merchant SKU
// router.post(
//     '/generate-sku',
//     requireRole('owner', 'admin', 'manager'),
//     [
//         body('platformProductIds').isArray({ min: 1 }).withMessage('Select at least one product'),
//         body('platformProductIds.*').isInt({ min: 1 }).toInt(),
//         body('warehouseId').notEmpty().isInt({ min: 1 }).toInt().withMessage('Warehouse is required'),
//     ],
//     ctrl.generateSku
// );

// // POST /api/v1/platform-products/auto-mapping        - Auto Mapping button
// router.post(
//     '/auto-mapping',
//     requireRole('owner', 'admin', 'manager'),
//     [
//         body('platformProductIds').optional().isArray(),
//         body('platformProductIds.*').optional().isInt({ min: 1 }).toInt(),
//         body('warehouseId').notEmpty().isInt({ min: 1 }).toInt().withMessage('Warehouse is required'),
//     ],
//     ctrl.autoMap
// );

// // POST /api/v1/platform-products/push-stock          - Push stock to platform
// router.post(
//     '/push-stock',
//     requireRole('owner', 'admin', 'manager'),
//     [
//         body('mappingId').notEmpty().isInt({ min: 1 }).toInt(),
//         body('newQty').notEmpty().isInt({ min: 0 }).toInt(),
//     ],
//     ctrl.pushStock
// );

// // ── NEW ──────────────────────────────────────────────────────────────────────
// // POST /api/v1/platform-products/map-merchant-sku
// // Called from ByProductSKUMappingPage when user clicks
// // "Add Mapping with Store" on an UNMAPPED product row and picks a merchant SKU.
// //
// // Body: { platformProductId: number, merchantSkuId: number }
// // ─────────────────────────────────────────────────────────────────────────────
// router.post(
//     '/map-merchant-sku',
//     requireRole('owner', 'admin', 'manager'),
//     [
//         body('platformProductId')
//             .notEmpty().withMessage('platformProductId is required')
//             .isInt({ min: 1 }).toInt(),
//         body('merchantSkuId')
//             .notEmpty().withMessage('merchantSkuId is required')
//             .isInt({ min: 1 }).toInt(),
//     ],
//     ctrl.mapMerchantSku
// );



// // DELETE /api/v1/platform-products/mapping/:mappingId - Unlink (unmap)
// router.delete('/mapping/:mappingId', requireRole('owner', 'admin', 'manager'), ctrl.unlink);

// module.exports = router;


'use strict';

const express = require('express');
const router  = express.Router();
const ctrl    = require('./platformProducts.controller');
const { authenticate, requireRole } = require('../../middlewares/auth');
const { body, query } = require('express-validator');

router.use(authenticate);

// GET /api/v1/platform-products                         - flat list (backward compat / picker)
router.get('/', ctrl.getList);

// GET /api/v1/platform-products/hierarchy               - 3-level tree for ByProductSKUMappingPage
// Returns parent rows with children[] and platform_mappings[] per child
router.get('/hierarchy', ctrl.getHierarchy);

// GET /api/v1/platform-products/counts                  - tab badge counts
router.get('/counts', ctrl.getCounts);

// POST /api/v1/platform-products/sync                   - Sync Product button
// Query: ?platformStoreId=1 (optional)
router.post('/sync', requireRole('owner', 'admin', 'manager'), ctrl.syncProducts);

// POST /api/v1/platform-products/generate-sku           - Generate Merchant SKU
// Body: { platformProductIds: [1,2], warehouseId: 1 }
// SKU format: [PlatformPrefix]-[SellerSKU]-[WarehouseCode]
router.post(
    '/generate-sku',
    requireRole('owner', 'admin', 'manager'),
    [
        body('platformProductIds').isArray({ min: 1 }).withMessage('Select at least one product'),
        body('platformProductIds.*').isInt({ min: 1 }).toInt(),
        body('warehouseId').notEmpty().isInt({ min: 1 }).toInt().withMessage('Warehouse is required'),
    ],
    ctrl.generateSku
);

// POST /api/v1/platform-products/auto-mapping           - Auto Mapping button
// Body: { platformProductIds?: [], platformStoreIds?: [], platform?: string }
// If platformProductIds empty → map ALL unmapped SKUs that already have/generated match a Merchant SKU
router.post(
    '/auto-mapping',
    requireRole('owner', 'admin', 'manager'),
    [
        body('platformProductIds').optional().isArray(),
        body('platformProductIds.*').optional().isInt({ min: 1 }).toInt(),
        body('platformStoreId').optional().isInt({ min: 1 }).toInt(),
        body('platformStoreIds').optional().isArray(),
        body('platformStoreIds.*').optional().isInt({ min: 1 }).toInt(),
        body('platform').optional().isString(),
    ],
    ctrl.autoMap
);

// POST /api/v1/platform-products/push-stock             - Push stock to platform
router.post(
    '/push-stock',
    requireRole('owner', 'admin', 'manager'),
    [
        body('mappingId').notEmpty().isInt({ min: 1 }).toInt(),
        body('newQty').notEmpty().isInt({ min: 0 }).toInt(),
    ],
    ctrl.pushStock
);

// POST /api/v1/platform-products/map-merchant-sku
// "Add Mapping with Store" from ByProductSKUMappingPage
// Body: { platformProductId: number, merchantSkuId: number }
router.post(
    '/map-merchant-sku',
    requireRole('owner', 'admin', 'manager'),
    [
        body('platformProductId').notEmpty().isInt({ min: 1 }).toInt(),
        body('merchantSkuId').notEmpty().isInt({ min: 1 }).toInt(),
    ],
    ctrl.mapMerchantSku
);

// DELETE /api/v1/platform-products/mapping/:mappingId   - Unlink (unmap)
router.delete('/mapping/:mappingId', requireRole('owner', 'admin', 'manager'), ctrl.unlink);

module.exports = router;