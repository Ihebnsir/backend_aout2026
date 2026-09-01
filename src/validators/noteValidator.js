const { body, validationResult } = require('express-validator');

const createNoteRules = [
  body('centreId').isMongoId().withMessage('centreId invalide'),
  body('formationId').optional().isMongoId().withMessage('formationId invalide'),
  body('note').isInt({ min: 1, max: 5 }).withMessage('note doit être entre 1 et 5'),
  body('commentaire').optional().isString().trim().withMessage('commentaire invalide'),
];

const updateNoteRules = [
  body('note').optional().isInt({ min: 1, max: 5 }).withMessage('note doit être entre 1 et 5'),
  body('commentaire').optional().isString().trim().withMessage('commentaire invalide'),
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
  createNoteRules,
  updateNoteRules,
  validateRequest,
};
