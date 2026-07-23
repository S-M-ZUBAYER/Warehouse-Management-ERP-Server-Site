const notFound = (req, res) => {
    res.status(404).json({
        success: false,
        message: `Route ${req.originalUrl} not found`,
        errors: [{
            field: 'route',
            message: 'The requested endpoint does not exist'
        }]
    });
};

module.exports = notFound;