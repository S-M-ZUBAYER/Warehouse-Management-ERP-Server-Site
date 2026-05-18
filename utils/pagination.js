// 'use strict';

// /**
//  * Reusable Sequelize paginator
//  * @param {Model} Model - Sequelize model
//  * @param {object} queryOptions - { where, include, order, attributes }
//  * @param {object} pageOptions  - { page, limit }
//  * @returns { data, pagination }
//  */
// const paginate = async (Model, queryOptions = {}, { page = 1, limit = 20 } = {}) => {
//     const parsedPage = Math.max(1, parseInt(page));
//     const parsedLimit = Math.min(100, Math.max(1, parseInt(limit)));
//     const offset = (parsedPage - 1) * parsedLimit;

//     const { count, rows } = await Model.findAndCountAll({
//         ...queryOptions,
//         limit: parsedLimit,
//         offset,
//         distinct: true, // Required when using include with hasMany
//     });

//     return {
//         data: rows,
//         pagination: {
//             total: count,
//             page: parsedPage,
//             limit: parsedLimit,
//             totalPages: Math.ceil(count / parsedLimit),
//         },
//     };
// };

// module.exports = { paginate };