const { body, validationResult, param } = require('express-validator');

const createCertificationRules = [
  body('apprenantId').isMongoId().withMessage('apprenantId invalide'),
  body('formationId').isMongoId().withMessage('formationId invalide'),
  body('centreId').isMongoId().withMessage('centreId invalide'),
  body('dateObtention').isISO8601().withMessage('dateObtention doit être une date valide'),
];

const verifyCertificationRules = [
  param('numeroCertificat').trim().notEmpty().withMessage('numeroCertificat obligatoire'),
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
  createCertificationRules,
  verifyCertificationRules,
  validateRequest,
};
