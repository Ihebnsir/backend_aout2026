const express = require('express');
const router = express.Router();
const trainerController = require('../controllers/trainerController');
const { authenticate } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');
const { trainerRules, validateRequest } = require('../validators/trainerValidator');

router.get('/me/trainers', authenticate, requireRole('centre'), trainerController.getMyTrainers);
router.get('/me/trainers/:id', authenticate, requireRole('centre', 'admin'), trainerController.getTrainerById);
router.post('/me/trainers', authenticate, requireRole('centre'), trainerRules, validateRequest, trainerController.createTrainer);
router.put('/me/trainers/:id', authenticate, requireRole('centre', 'admin'), trainerRules, validateRequest, trainerController.updateTrainer);
router.patch('/me/trainers/:id/status', authenticate, requireRole('centre', 'admin'), trainerController.updateTrainerStatus);
router.delete('/me/trainers/:id', authenticate, requireRole('centre', 'admin'), trainerController.deleteTrainer);

module.exports = router;
