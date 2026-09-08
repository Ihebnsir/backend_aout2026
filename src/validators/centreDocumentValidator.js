const { body, validationResult, query } = require('express-validator');

const documentTypes = ['registre_commerce', 'diplome_formateur', 'autorisation', 'assurance', 'certification', 'autre'];
const documentStatuses = ['en_attente', 'valide', 'refuse'];

const uploadDocumentRules = [
  body('type').isIn(documentTypes).withMessage('type invalide'),
  body('fileUrl')
    .isURL({ protocols: ['http', 'https'], require_protocol: true })
    .withMessage('fileUrl doit être une URL HTTP ou HTTPS valide')
    .isLength({ max: 500 })
    .withMessage('fileUrl ne doit pas dépasser 500 caractères'),
];

const documentDecisionRules = [
  body('commentaireAdmin')
    .optional()
    .isString()
    .withMessage('commentaireAdmin invalide')
    .isLength({ max: 2000 })
    .withMessage('commentaireAdmin ne doit pas dépasser 2000 caractères'),
];

const adminDocumentListRules = [
  query('page').optional().isInt({ min: 1 }).withMessage('page doit être >= 1'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('limit doit être entre 1 et 100'),
  query('status').optional().isIn(documentStatuses).withMessage('status invalide'),
  query('type').optional().isIn(documentTypes).withMessage('type invalide'),
  query('centre').optional().isMongoId().withMessage('centre doit être un ObjectId valide'),
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
  uploadDocumentRules,
  documentDecisionRules,
  adminDocumentListRules,
  validateRequest,
};
