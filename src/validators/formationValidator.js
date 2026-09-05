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

const optionalString = (field, max, message) =>
  body(field).optional({ nullable: true }).trim().isLength({ max }).withMessage(message);

const optionalNumber = (field, min, max, message) =>
  body(field).optional({ nullable: true }).isFloat({ min, max }).withMessage(message);

const sessionsRule = body('sessions')
  .optional({ nullable: true })
  .isArray()
  .withMessage('sessions doit être un tableau')
  .custom((sessions) => sessions.every((session) => (
    session && typeof session.title === 'string' && session.title.trim()
      && Number.isInteger(Number(session.order)) && Number(session.order) >= 1
      && (!session.description || typeof session.description === 'string')
      && (!session.duration || typeof session.duration === 'string')
      && (!session.date || !Number.isNaN(Date.parse(session.date)))
  )))
  .withMessage('Chaque session doit contenir un titre et un ordre valide');

const createFormationRules = [
  body('title')
    .trim()
    .notEmpty()
    .withMessage('Le titre de la formation est obligatoire')
    .isLength({ max: 200 })
    .withMessage('Le titre ne doit pas dépasser 200 caractères'),

  body('price')
    .notEmpty()
    .withMessage('Le prix est obligatoire')
    .isFloat({ min: 0 })
    .withMessage('Le prix doit être un nombre >= 0'),

  body('duration')
    .trim()
    .notEmpty()
    .withMessage('La durée est obligatoire')
    .isLength({ max: 100 })
    .withMessage('La durée ne doit pas dépasser 100 caractères'),

  optionalString('category', 100, 'La catégorie ne doit pas dépasser 100 caractères'),

  optionalString('categorie', 100, 'La catégorie (code) ne doit pas dépasser 100 caractères'),

  optionalString('description', 5000, 'La description ne doit pas dépasser 5000 caractères'),

  body('status')
    .optional({ nullable: true })
    .isIn(['pending', 'confirmed', 'in-progress', 'completed'])
    .withMessage('Le statut doit être : pending, confirmed, in-progress, ou completed'),

  body('offreStage')
    .optional({ nullable: true })
    .isBoolean()
    .withMessage('offreStage doit être un booléen'),

  body('entreprisesPartenaires')
    .optional({ nullable: true })
    .isArray()
    .withMessage('enterprisesPartenaires doit être un tableau')
    .custom((value) => {
      if (!Array.isArray(value)) return false;
      return value.every((item) => typeof item === 'string');
    })
    .withMessage('Tous les éléments de enterprisesPartenaires doivent être des chaînes'),

  optionalNumber('progress', 0, 100, 'Le progrès doit être entre 0 et 100'),

  body('startDate')
    .optional({ nullable: true })
    .isISO8601()
    .withMessage('La date de début doit être au format ISO8601'),

  body('endDate')
    .optional({ nullable: true })
    .isISO8601()
    .withMessage('La date de fin doit être au format ISO8601'),

  body('image')
    .optional({ nullable: true })
    .trim()
    .custom((value) => {
      if (value && value.length > 0) {
        try {
          new URL(value);
          return true;
        } catch {
          throw new Error('Image doit être une URL valide');
        }
      }
      return true;
    }),

  sessionsRule,

  // Vérifier que les champs sensibles ne sont pas présents
  body('centre')
    .custom((value) => {
      if (value !== undefined) {
        throw new Error('Vous ne pouvez pas définir le centre');
      }
      return true;
    })
    .optional(),

  body('_id')
    .custom((value) => {
      if (value !== undefined) {
        throw new Error('Vous ne pouvez pas définir _id');
      }
      return true;
    })
    .optional(),

  body('createdAt')
    .custom((value) => {
      if (value !== undefined) {
        throw new Error('Vous ne pouvez pas définir createdAt');
      }
      return true;
    })
    .optional(),

  body('updatedAt')
    .custom((value) => {
      if (value !== undefined) {
        throw new Error('Vous ne pouvez pas définir updatedAt');
      }
      return true;
    })
    .optional(),
];

const updateFormationRules = [
  body('title')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Le titre ne peut pas être vide')
    .isLength({ max: 200 })
    .withMessage('Le titre ne doit pas dépasser 200 caractères'),

  body('price')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Le prix doit être un nombre >= 0'),

  body('duration')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('La durée ne peut pas être vide')
    .isLength({ max: 100 })
    .withMessage('La durée ne doit pas dépasser 100 caractères'),

  optionalString('category', 100, 'La catégorie ne doit pas dépasser 100 caractères'),

  optionalString('categorie', 100, 'La catégorie (code) ne doit pas dépasser 100 caractères'),

  optionalString('description', 5000, 'La description ne doit pas dépasser 5000 caractères'),

  body('status')
    .optional({ nullable: true })
    .isIn(['pending', 'confirmed', 'in-progress', 'completed'])
    .withMessage('Le statut doit être : pending, confirmed, in-progress, ou completed'),

  body('offreStage')
    .optional({ nullable: true })
    .isBoolean()
    .withMessage('offreStage doit être un booléen'),

  body('entreprisesPartenaires')
    .optional({ nullable: true })
    .isArray()
    .withMessage('enterprisesPartenaires doit être un tableau')
    .custom((value) => {
      if (!Array.isArray(value)) return false;
      return value.every((item) => typeof item === 'string');
    })
    .withMessage('Tous les éléments de enterprisesPartenaires doivent être des chaînes'),

  optionalNumber('progress', 0, 100, 'Le progrès doit être entre 0 et 100'),

  body('startDate')
    .optional({ nullable: true })
    .isISO8601()
    .withMessage('La date de début doit être au format ISO8601'),

  body('endDate')
    .optional({ nullable: true })
    .isISO8601()
    .withMessage('La date de fin doit être au format ISO8601'),

  body('image')
    .optional({ nullable: true })
    .trim()
    .custom((value) => {
      if (value && value.length > 0) {
        try {
          new URL(value);
          return true;
        } catch {
          throw new Error('Image doit être une URL valide');
        }
      }
      return true;
    }),

  sessionsRule,

  // Vérifier que les champs sensibles ne sont pas présents
  body('centre')
    .custom((value) => {
      if (value !== undefined) {
        throw new Error('Vous ne pouvez pas modifier le centre');
      }
      return true;
    })
    .optional(),

  body('_id')
    .custom((value) => {
      if (value !== undefined) {
        throw new Error('Vous ne pouvez pas modifier _id');
      }
      return true;
    })
    .optional(),

  body('createdAt')
    .custom((value) => {
      if (value !== undefined) {
        throw new Error('Vous ne pouvez pas modifier createdAt');
      }
      return true;
    })
    .optional(),

  body('updatedAt')
    .custom((value) => {
      if (value !== undefined) {
        throw new Error('Vous ne pouvez pas modifier updatedAt');
      }
      return true;
    })
    .optional(),
];

module.exports = {
  createFormationRules,
  updateFormationRules,
  validateRequest,
};
