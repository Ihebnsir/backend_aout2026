const { query, param, validationResult } = require('express-validator');

const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Données invalides',
      errors: errors.array().map((error) => ({
        field: error.path,
        message: error.msg,
      })),
    });
  }
  return next();
};

const overviewRules = []; // No params for overview

const growthRules = [
  query('period')
    .optional()
    .isIn(['week', 'month'])
    .withMessage("period doit être 'week' ou 'month'"),

  query('months')
    .optional()
    .isInt({ min: 1, max: 24 })
    .withMessage('months doit être entre 1 et 24'),
];

const revenueRules = [
  query('period')
    .optional()
    .isIn(['week', 'month'])
    .withMessage("period doit être 'week' ou 'month'"),

  query('months')
    .optional()
    .isInt({ min: 1, max: 24 })
    .withMessage('months doit être entre 1 et 24'),
];

const repartitionRules = [
  param('type')
    .isIn(['reservations', 'formations', 'centres'])
    .withMessage("type doit être 'reservations', 'formations' ou 'centres'"),
];

const topRules = [
  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('limit doit être entre 1 et 50'),
];

const activiteRules = [
  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('limit doit être entre 1 et 50'),
];

module.exports = {
  validateRequest,
  overviewRules,
  growthRules,
  revenueRules,
  repartitionRules,
  topRules,
  activiteRules,
};
