'use strict';

/**
 * SkuWarehouseStock.js  (UPDATED)
 *
 * Adds: min_stock column for stock alert threshold
 * Run migration 016_add_min_stock_to_sku_warehouse_stock.sql first.
 */
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const SkuWarehouseStock = sequelize.define('SkuWarehouseStock', {
        id: {
            type: DataTypes.INTEGER.UNSIGNED,
            autoIncrement: true,
            primaryKey: true,
        },
        company_id:       { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
        merchant_sku_id:  { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
        warehouse_id:     { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
        qty_on_hand:      { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
        qty_reserved:     { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
        qty_inbound:      { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },

        // ── NEW: stock alert threshold ─────────────────────────────────────
        // NULL = no alert configured
        // When qty_on_hand <= min_stock → Low Stock
        // When qty_on_hand = 0 → Out of Stock
        min_stock: {
            type:         DataTypes.INTEGER.UNSIGNED,
            allowNull:    true,
            defaultValue: null,
            comment:      'Minimum stock alert threshold. NULL = no alert set.',
        },

        // qty_available is a MySQL generated column — expose as Sequelize virtual
        qty_available: {
            type: DataTypes.VIRTUAL,
            get() {
                return Math.max(0, (this.get('qty_on_hand') || 0) - (this.get('qty_reserved') || 0));
            },
        },
    }, {
        tableName: 'sku_warehouse_stock',
        timestamps: true,
        updatedAt: 'updated_at',
        createdAt: 'created_at',
        underscored: true,
        indexes: [
            { unique: true, fields: ['merchant_sku_id', 'warehouse_id'], name: 'uq_sku_warehouse_stock' },
            { fields: ['company_id'],       name: 'idx_sws_company'      },
            { fields: ['merchant_sku_id'],  name: 'idx_sws_merchant_sku' },
            { fields: ['warehouse_id'],     name: 'idx_sws_warehouse'    },
            { fields: ['company_id', 'min_stock'], name: 'idx_sws_min_stock' },
        ],
    });

    SkuWarehouseStock.associate = (models) => {
        SkuWarehouseStock.belongsTo(models.MerchantSku, { foreignKey: 'merchant_sku_id', as: 'merchantSku' });
        SkuWarehouseStock.belongsTo(models.Warehouse,   { foreignKey: 'warehouse_id',    as: 'warehouse'   });
        if (models.StockLedgerEntry) {
            SkuWarehouseStock.hasMany(models.StockLedgerEntry, {
                foreignKey: 'sku_warehouse_stock_id',
                as: 'ledgerEntries',
            });
        }
    };

    return SkuWarehouseStock;
};
