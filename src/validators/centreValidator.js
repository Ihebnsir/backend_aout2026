const { body, validationResult } = require('express-validator');

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

const optionalString = (field, max, message) =>
  body(field).optional({ nullable: true }).trim().isLength({ max }).withMessage(message);

const buildCentreRules = (isUpdate) => [
  isUpdate ? body('name').optional().trim().notEmpty().withMessage('Le nom ne peut pas être vide').isLength({ max: 150 }).withMessage('Nom trop long') : body('name').trim().notEmpty().withMessage('Le nom du centre est obligatoire').isLength({ max: 150 }).withMessage('Nom trop long'),
  optionalString('responsable', 150, 'Responsable trop long'),
  body('email').optional({ nullable: true }).isEmail().withMessage('Email invalide').normalizeEmail(),
  optionalString('telephone', 30, 'Téléphone invalide'),
  optionalString('ville', 100, 'Ville trop longue'),
  optionalString('adresse', 250, 'Adresse trop longue'),
  optionalString('description', 2000, 'Description trop longue'),
  optionalString('domaine', 150, 'Domaine trop long'),
  body('siteWeb').optional({ nullable: true }).isURL({ protocols: ['http', 'https'], require_protocol: true }).withMessage('URL invalide'),
  body('coordonneesGPS.lat').optional().isFloat({ min: -90, max: 90 }).withMessage('Latitude invalide'),
  body('coordonneesGPS.lng').optional().isFloat({ min: -180, max: 180 }).withMessage('Longitude invalide'),
];

const createCentreRules = buildCentreRules(false);
const updateCentreRules = buildCentreRules(true);

module.exports = { createCentreRules, updateCentreRules, validateRequest };