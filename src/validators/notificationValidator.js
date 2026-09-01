const { query, validationResult } = require('express-validator');

const listNotificationsRules = [
  query('onlyUnread').optional().isBoolean().withMessage('onlyUnread doit être un booléen'),
  query('category')
    .optional()
    .isIn([
      'users',
      'centres',
      'formations',
      'signalements',
      'paiements',
      'system',
      'partenariats',
      'litiges',
      'reservations',
      'messages',
      'certificats',
      'documents',
      'sessions',
    ])
    .withMessage('category invalide'),
  query('page').optional().isInt({ min: 1 }).withMessage('page doit être >= 1'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('limit doit être entre 1 et 100'),
];

const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Erreurs de validation',
      errors: errors.array(),
    });
  }
  next();
};

module.exports = {
  listNotificationsRules,
  validateRequest,
};
