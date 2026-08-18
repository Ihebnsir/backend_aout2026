const { body, validationResult } = require('express-validator');

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

const loginRules = [
  body('email').trim().notEmpty().withMessage('L’email est obligatoire').isEmail().withMessage('Email invalide'),
  body('password').notEmpty().withMessage('Le mot de passe est obligatoire'),
];

module.exports = {
  loginRules,
  validateRequest,
};
