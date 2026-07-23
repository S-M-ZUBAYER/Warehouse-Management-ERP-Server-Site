'use strict';

const sendSuccess = (res, message, data = null, statusCode = 200, pagination = null) => {
    const response = { success: true, message };
    if (data !== null && data !== undefined) response.data = data;
    if (pagination) response.pagination = pagination;
    return res.status(statusCode).json(response);
};

const sendError = (res, message, statusCode = 400, errors = null) => {
    const response = { success: false, message };
    if (errors && errors.length > 0) response.errors = errors;
    return res.status(statusCode).json(response);
};

module.exports = { sendSuccess, sendError };