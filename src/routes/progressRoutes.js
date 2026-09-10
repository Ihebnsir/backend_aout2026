const express = require('express');
const router = express.Router();
const progressController = require('../controllers/progressController');
const { authenticate } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');
const { progressRules, validateRequest } = require('../validators/progressValidator');

router.get('/me', authenticate, requireRole('apprenant'), progressController.getMyProgress);
router.get('/:id', authenticate, progressController.getProgressById);
router.get('/formation/:formationId', authenticate, requireRole('centre'), progressController.getProgressByFormation);
router.post('/', authenticate, requireRole('apprenant', 'centre'), progressRules, validateRequest, progressController.createProgress);
router.put('/:id', authenticate, requireRole('centre'), progressRules, validateRequest, progressController.updateProgress);

module.exports = router;
