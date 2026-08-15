const { body, validationResult } = require('express-validator');

const validRoles = ['apprenant', 'centre', 'admin'];
const validStatuses = ['active', 'inactive', 'pending', 'suspended'];

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

const createUserRules = [
  body('nom').trim().notEmpty().withMessage('Le nom est obligatoire'),
  body('prenom').trim().notEmpty().withMessage('Le prénom est obligatoire'),
  body('email').isEmail().withMessage('Email invalide').normalizeEmail(),
  body('password').isLength({ min: 8 }).withMessage('Le mot de passe doit contenir au moins 8 caractères'),
  body('telephone').optional().trim().isLength({ min: 8 }).withMessage('Téléphone invalide'),
  body('role').optional().isIn(validRoles).withMessage('Rôle invalide'),
  body('status').optional().isIn(validStatuses).withMessage('Statut invalide'),
];

const updateUserRules = [
  body('nom').optional().trim().notEmpty().withMessage('Le nom ne peut pas être vide'),
  body('prenom').optional().trim().notEmpty().withMessage('Le prénom ne peut pas être vide'),
  body('email').optional().isEmail().withMessage('Email invalide').normalizeEmail(),
  body('password').optional().isLength({ min: 8 }).withMessage('Le mot de passe doit contenir au moins 8 caractères'),
  body('telephone').optional().trim().isLength({ min: 8 }).withMessage('Téléphone invalide'),
  body('role').optional().isIn(validRoles).withMessage('Rôle invalide'),
  body('status').optional().isIn(validStatuses).withMessage('Statut invalide'),
];

module.exports = {
  createUserRules,
  updateUserRules,
  validRoles,
  validStatuses,
  validateRequest,
};
