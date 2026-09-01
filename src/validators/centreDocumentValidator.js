const { body, validationResult, query } = require('express-validator');

const uploadDocumentRules = [
  body('type').isIn(['registre_commerce', 'diplome_formateur', 'autorisation', 'assurance', 'certification', 'autre']).withMessage('type invalide'),
  body('fileUrl').isURL().withMessage('fileUrl doit être une URL valide'),
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
  validateRequest,
};
