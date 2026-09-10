const { body, validationResult } = require('express-validator');

const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, message: 'Données invalides', errors: errors.array() });
  }
  return next();
};

const attendanceRules = [
  body('session').isMongoId().withMessage('session invalide'),
  body('learner').isMongoId().withMessage('learner invalide'),
  body('formation').isMongoId().withMessage('formation invalide'),
  body('centre').isMongoId().withMessage('centre invalide'),
  body('status').isIn(['present', 'absent', 'late']).withMessage('status invalide'),
  body('note').optional({ nullable: true }).trim().isLength({ max: 1000 }).withMessage('note trop longue'),
];

module.exports = { attendanceRules, validateRequest };
