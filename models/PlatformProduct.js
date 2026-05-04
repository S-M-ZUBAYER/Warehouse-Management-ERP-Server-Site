// 'use strict';
// const { DataTypes } = require('sequelize');

// module.exports = (sequelize) => {
//     const PlatformProduct = sequelize.define('PlatformProduct', {
//         id: {
//             type:          DataTypes.INTEGER.UNSIGNED,
//             autoIncrement: true,
//             primaryKey:    true,
//         },
//         company_id:            { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
//         platform_store_id:     { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
//         platform:              { type: DataTypes.STRING(32),        allowNull: false },
//         platform_product_id:   { type: DataTypes.STRING(128),       allowNull: false },
//         platform_sku_id:       { type: DataTypes.STRING(128),       allowNull: true  },
//         platform_model_id:     { type: DataTypes.STRING(128),       allowNull: true  },
//         platform_location_id:  { type: DataTypes.STRING(64),        allowNull: true  },
//         platform_warehouse_id: { type: DataTypes.STRING(128),       allowNull: true  },
//         product_name:          { type: DataTypes.STRING(512),       allowNull: false },
//         variation_name:        { type: DataTypes.STRING(255),       allowNull: true  },
//         parent_sku:            { type: DataTypes.STRING(128),       allowNull: true  },
//         seller_sku:            { type: DataTypes.STRING(128),       allowNull: true  },
//         image_url:             { type: DataTypes.STRING(1000),      allowNull: true  },
//         store_name:            { type: DataTypes.STRING(255),       allowNull: true  },
//         platform_stock:        { type: DataTypes.INTEGER,           allowNull: false, defaultValue: 0 },
//         platform_price:        { type: DataTypes.DECIMAL(12, 2),    allowNull: true  },
//         currency:              { type: DataTypes.STRING(10),        allowNull: true  },
//         is_mapped:             { type: DataTypes.TINYINT(1),        allowNull: false, defaultValue: 0 },
//         row_type:              { type: DataTypes.ENUM('parent', 'child'), allowNull: false, defaultValue: 'child' },
//         synced_at:             { type: DataTypes.DATE,              allowNull: false, defaultValue: DataTypes.NOW },
//     }, {
//         tableName:  'platform_products',
//         timestamps: true,
//         underscored: true,
//         indexes: [
//             { unique: true, fields: ['platform_store_id', 'platform_product_id', 'platform_sku_id'], name: 'uq_pp_sku' },
//             { fields: ['company_id'],             name: 'idx_pp_company'  },
//             { fields: ['platform_store_id'],      name: 'idx_pp_store'    },
//             { fields: ['company_id', 'is_mapped'],name: 'idx_pp_mapped'   },
//             { fields: ['platform_store_id', 'row_type'], name: 'idx_pp_row_type' },
//         ],
//     });

//     PlatformProduct.associate = (models) => {
//         PlatformProduct.belongsTo(models.PlatformStore, { foreignKey: 'platform_store_id', as: 'platformStore' });
//         PlatformProduct.belongsTo(models.Company,       { foreignKey: 'company_id',        as: 'company'       });
//         PlatformProduct.hasMany(models.PlatformSkuMapping, { foreignKey: 'platform_product_id', sourceKey: 'platform_product_id', as: 'skuMappings' });
//     };

//     return PlatformProduct;
// };


'use strict';
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const PlatformProduct = sequelize.define('PlatformProduct', {
        id: {
            type:          DataTypes.INTEGER.UNSIGNED,
            autoIncrement: true,
            primaryKey:    true,
        },
        company_id:            { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
        platform_store_id:     { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
        platform:              { type: DataTypes.STRING(32),        allowNull: false },
        platform_product_id:   { type: DataTypes.STRING(128),       allowNull: false },
        platform_sku_id:       { type: DataTypes.STRING(128),       allowNull: true  },
        platform_model_id:     { type: DataTypes.STRING(128),       allowNull: true  },
        platform_location_id:  { type: DataTypes.STRING(64),        allowNull: true  },
        platform_warehouse_id: { type: DataTypes.STRING(128),       allowNull: true  },
        product_name:          { type: DataTypes.STRING(512),       allowNull: false },
        variation_name:        { type: DataTypes.STRING(255),       allowNull: true  },
        parent_sku:            { type: DataTypes.STRING(128),       allowNull: true  },
        seller_sku:            { type: DataTypes.STRING(128),       allowNull: true  },
        image_url:             { type: DataTypes.STRING(1000),      allowNull: true  },
        store_name:            { type: DataTypes.STRING(255),       allowNull: true  },
        platform_stock:        { type: DataTypes.INTEGER,           allowNull: false, defaultValue: 0 },
        platform_price:        { type: DataTypes.DECIMAL(12, 2),    allowNull: true  },
        currency:              { type: DataTypes.STRING(10),        allowNull: true  },
        product_status:        { type: DataTypes.STRING(64),        allowNull: true  },
        has_variants:          { type: DataTypes.BOOLEAN,           allowNull: false, defaultValue: false },
        weight:                { type: DataTypes.DECIMAL(10, 2),    allowNull: true  },
        length:                { type: DataTypes.DECIMAL(10, 2),    allowNull: true  },
        width:                 { type: DataTypes.DECIMAL(10, 2),    allowNull: true  },
        height:                { type: DataTypes.DECIMAL(10, 2),    allowNull: true  },
        is_mapped:             { type: DataTypes.TINYINT(1),        allowNull: false, defaultValue: 0 },
        row_type:              { type: DataTypes.ENUM('parent', 'child'), allowNull: false, defaultValue: 'child' },
        synced_at:             { type: DataTypes.DATE,              allowNull: false, defaultValue: DataTypes.NOW },
    }, {
        tableName:  'platform_products',
        timestamps: true,
        underscored: true,
        indexes: [
            { unique: true, fields: ['platform_store_id', 'platform_product_id', 'platform_sku_id'], name: 'uq_pp_sku' },
            { fields: ['company_id'],             name: 'idx_pp_company'  },
            { fields: ['platform_store_id'],      name: 'idx_pp_store'    },
            { fields: ['company_id', 'is_mapped'],name: 'idx_pp_mapped'   },
            { fields: ['platform_store_id', 'row_type'], name: 'idx_pp_row_type' },
            { fields: ['company_id', 'product_status'], name: 'idx_pp_company_status' },
        ],
    });

    PlatformProduct.associate = (models) => {
        PlatformProduct.belongsTo(models.PlatformStore, { foreignKey: 'platform_store_id', as: 'platformStore' });
        PlatformProduct.belongsTo(models.Company,       { foreignKey: 'company_id',        as: 'company'       });
        PlatformProduct.hasMany(models.PlatformSkuMapping, { foreignKey: 'platform_product_id', sourceKey: 'platform_product_id', as: 'skuMappings' });
    };

    return PlatformProduct;
};