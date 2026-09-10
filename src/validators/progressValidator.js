const { body, validationResult } = require('express-validator');

const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, message: 'Données invalides', errors: errors.array() });
  }
  return next();
};

const progressRules = [
  body('learner').isMongoId().withMessage('learner invalide'),
  body('formation').isMongoId().withMessage('formation invalide'),
  body('reservation').isMongoId().withMessage('reservation invalide'),
  body('centre').isMongoId().withMessage('centre invalide'),
  body('percentage').isFloat({ min: 0, max: 100 }).withMessage('percentage doit être entre 0 et 100'),
  body('completedSessions').isInt({ min: 0 }).withMessage('completedSessions invalide'),
  body('totalSessions').isInt({ min: 0 }).withMessage('totalSessions invalide'),
  body('status').optional().isIn(['not-started', 'in-progress', 'completed']).withMessage('status invalide'),
];

module.exports = { progressRules, validateRequest };
