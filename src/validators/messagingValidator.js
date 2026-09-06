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
  body('content').optional().isString().trim().isLength({ max: 5000 }).withMessage('content ne doit pas dépasser 5000 caractères'),
  body('attachments').optional().isArray({ max: Number(process.env.MAX_ATTACHMENTS_PER_MESSAGE || 5) }).withMessage('attachments invalide'),
  body('clientMessageId').optional().isString().trim().isLength({ min: 1, max: 100 }).withMessage('clientMessageId invalide'),
  body().custom((value, { req }) => {
    const hasContent = typeof req.body.content === 'string' && req.body.content.trim().length > 0;
    const attachments = Array.isArray(req.body.attachments) ? req.body.attachments : [];
    if (!hasContent && attachments.length === 0) {
      throw new Error('content ou attachments est obligatoire');
    }
    return true;
  }),
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
