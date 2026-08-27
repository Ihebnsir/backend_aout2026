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

const registerRules = [
  body('role').optional().isIn(['apprenant', 'centre']).withMessage('Rôle invalide'),
  body('nom')
    .if(body('role').not().equals('centre'))
    .trim()
    .notEmpty()
    .withMessage('Le nom est obligatoire')
    .isLength({ max: 100 })
    .withMessage('Nom trop long'),
  body('prenom')
    .if(body('role').not().equals('centre'))
    .trim()
    .notEmpty()
    .withMessage('Le prénom est obligatoire')
    .isLength({ max: 100 })
    .withMessage('Prénom trop long'),
  body('name')
    .if(body('role').equals('centre'))
    .trim()
    .notEmpty()
    .withMessage('Le nom du centre est obligatoire')
    .isLength({ max: 150 })
    .withMessage('Nom du centre trop long'),
  body('responsable')
    .if(body('role').equals('centre'))
    .trim()
    .notEmpty()
    .withMessage('Le responsable est obligatoire')
    .isLength({ max: 150 })
    .withMessage('Responsable trop long'),
  body('email').trim().notEmpty().withMessage('L’email est obligatoire').isEmail().withMessage('Email invalide').normalizeEmail(),
  body('password')
    .isString()
    .withMessage('Le mot de passe est obligatoire')
    .isLength({ min: 8 })
    .withMessage('Le mot de passe doit contenir au moins 8 caractères'),
];

module.exports = {
  loginRules,
  registerRules,
  validateRequest,
};
