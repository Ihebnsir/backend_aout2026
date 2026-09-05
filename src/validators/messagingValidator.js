const { body, query, param, validationResult } = require('express-validator');

const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Données invalides',
      errors: errors.array().map((error) => ({ field: error.path, message: error.msg })),
    });
  }
  return next();
};

const listRules = [
  query('page').optional().isInt({ min: 1 }).withMessage('page doit être >= 1'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('limit doit être entre 1 et 100'),
  query('type').optional().isIn(['direct', 'support']).withMessage('type invalide'),
  query('status').optional().isIn(['open', 'pending', 'resolved', 'closed']).withMessage('status invalide'),
  query('formationId').optional().isMongoId().withMessage('formationId invalide'),
  query('search').optional().isString().trim().isLength({ max: 100 }).withMessage('search invalide'),
];

const idRules = [param('id').isMongoId().withMessage('ID conversation invalide')];

const directRules = [
  body('centreId').isMongoId().withMessage('centreId invalide'),
  body('formationId').optional({ nullable: true }).isMongoId().withMessage('formationId invalide'),
  body('initialMessage').optional().isString().trim().isLength({ max: 5000 }).withMessage('initialMessage invalide'),
];

const supportRules = [
  body('subject').optional().isString().trim().isLength({ max: 200 }).withMessage('subject invalide'),
  body('initialMessage').optional().isString().trim().isLength({ max: 5000 }).withMessage('initialMessage invalide'),
];

const messageRules = [
  ...idRules,
  body('content').isString().trim().notEmpty().withMessage('content est obligatoire').isLength({ max: 5000 }).withMessage('content ne doit pas dépasser 5000 caractères'),
  body('clientMessageId').optional().isString().trim().isLength({ min: 1, max: 100 }).withMessage('clientMessageId invalide'),
];

const statusRules = [
  ...idRules,
  body('status').isIn(['open', 'pending', 'resolved', 'closed']).withMessage('status invalide'),
];

const paginationRules = [
  ...idRules,
  query('page').optional().isInt({ min: 1 }).withMessage('page doit être >= 1'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('limit doit être entre 1 et 100'),
];

module.exports = {
  validateRequest,
  listRules,
  idRules,
  directRules,
  supportRules,
  messageRules,
  statusRules,
  paginationRules,
};
