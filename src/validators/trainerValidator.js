const { body, validationResult } = require('express-validator');

const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, message: 'Données invalides', errors: errors.array() });
  }
  return next();
};

const trainerRules = [
  body('nom').trim().notEmpty().withMessage('nom obligatoire').isLength({ max: 100 }).withMessage('nom trop long'),
  body('prenom').trim().notEmpty().withMessage('prenom obligatoire').isLength({ max: 100 }).withMessage('prenom trop long'),
  body('email').isEmail().withMessage('email invalide').normalizeEmail(),
  body('telephone').optional({ nullable: true }).trim().isLength({ max: 30 }).withMessage('telephone trop long'),
  body('specialite').optional({ nullable: true }).trim().isLength({ max: 200 }).withMessage('specialite trop longue'),
  body('status').optional().isIn(['active', 'inactive']).withMessage('status invalide'),
];

module.exports = { trainerRules, validateRequest };
