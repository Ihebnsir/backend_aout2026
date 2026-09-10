const { body, validationResult } = require('express-validator');

const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, message: 'Données invalides', errors: errors.array() });
  }
  return next();
};

const sessionRules = [
  body('formation').isMongoId().withMessage('formation invalide'),
  body('title').trim().notEmpty().withMessage('title est obligatoire').isLength({ max: 200 }).withMessage('title trop long'),
  body('description').optional().trim().isLength({ max: 2000 }).withMessage('description trop longue'),
  body('date').isISO8601().withMessage('date invalide'),
  body('startTime').optional({ nullable: true }).trim().isLength({ max: 20 }).withMessage('startTime trop long'),
  body('endTime').optional({ nullable: true }).trim().isLength({ max: 20 }).withMessage('endTime trop long'),
  body('location').optional({ nullable: true }).trim().isLength({ max: 200 }).withMessage('location trop longue'),
  body('meetingUrl').optional({ nullable: true }).trim().isLength({ max: 500 }).withMessage('meetingUrl trop long'),
  body('status').optional().isIn(['scheduled', 'ongoing', 'completed', 'cancelled']).withMessage('status invalide'),
];

module.exports = { sessionRules, validateRequest };
