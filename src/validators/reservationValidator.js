const { body, validationResult, param } = require('express-validator');

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

const createReservationRules = [
  body('formationId')
    .notEmpty()
    .withMessage('formationId est obligatoire')
    .isMongoId()
    .withMessage('formationId doit être un ObjectId valide'),

  // Interdire les champs sensibles
  body('learnerId')
    .custom((value) => {
      if (value !== undefined) {
        throw new Error('Vous ne pouvez pas définir learnerId');
      }
      return true;
    })
    .optional(),

  body('centreId')
    .custom((value) => {
      if (value !== undefined) {
        throw new Error('Vous ne pouvez pas définir centreId');
      }
      return true;
    })
    .optional(),

  body('price')
    .custom((value) => {
      if (value !== undefined) {
        throw new Error('Vous ne pouvez pas définir price');
      }
      return true;
    })
    .optional(),

  body('paid')
    .custom((value) => {
      if (value !== undefined) {
        throw new Error('Vous ne pouvez pas modifier paid');
      }
      return true;
    })
    .optional(),

  body('paymentDate')
    .custom((value) => {
      if (value !== undefined) {
        throw new Error('Vous ne pouvez pas modifier paymentDate');
      }
      return true;
    })
    .optional(),

  body('paymentMethod')
    .custom((value) => {
      if (value !== undefined) {
        throw new Error('Vous ne pouvez pas définir paymentMethod ici');
      }
      return true;
    })
    .optional(),

  body('transactionId')
    .custom((value) => {
      if (value !== undefined) {
        throw new Error('Vous ne pouvez pas définir transactionId');
      }
      return true;
    })
    .optional(),

  body('status')
    .custom((value) => {
      if (value !== undefined) {
        throw new Error('Vous ne pouvez pas définir status');
      }
      return true;
    })
    .optional(),

  body('history')
    .custom((value) => {
      if (value !== undefined) {
        throw new Error('Vous ne pouvez pas modifier history');
      }
      return true;
    })
    .optional(),
];

const payReservationRules = [
  body('paymentMethod')
    .trim()
    .notEmpty()
    .withMessage('paymentMethod est obligatoire')
    .isLength({ max: 100 })
    .withMessage('paymentMethod ne doit pas dépasser 100 caractères'),

  // Interdire les modifications
  body('paid')
    .custom((value) => {
      if (value !== undefined) {
        throw new Error('Vous ne pouvez pas modifier paid');
      }
      return true;
    })
    .optional(),

  body('transactionId')
    .custom((value) => {
      if (value !== undefined) {
        throw new Error('Vous ne pouvez pas définir transactionId');
      }
      return true;
    })
    .optional(),

  body('paymentDate')
    .custom((value) => {
      if (value !== undefined) {
        throw new Error('Vous ne pouvez pas définir paymentDate');
      }
      return true;
    })
    .optional(),
];

const getReservationsByFormationRules = [
  param('formationId')
    .isMongoId()
    .withMessage('formationId doit être un ObjectId valide'),
];

module.exports = {
  createReservationRules,
  payReservationRules,
  getReservationsByFormationRules,
  validateRequest,
};
