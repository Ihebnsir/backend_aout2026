const express = require('express');

const router = express.Router();
const signalementController = require('../controllers/signalementController');
const { authenticate } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');
const {
  createSignalementRules,
  updateSignalementStatusRules,
  escaladerSignalementRules,
  listSignalementsRules,
  validateRequest,
} = require('../validators/signalementValidator');

// POST /api/signalements - Créer un signalement (tout rôle)
router.post('/', authenticate, createSignalementRules, validateRequest, signalementController.createSignalement);

// GET /api/signalements - Lister les signalements (admin)
router.get('/', authenticate, requireRole('admin'), listSignalementsRules, validateRequest, signalementController.listSignalements);

// GET /api/signalements/:id - Consulter un signalement (admin)
router.get('/:id', authenticate, requireRole('admin'), signalementController.getSignalementById);

// PATCH /api/signalements/:id/status - Changer le statut (admin)
router.patch('/:id/status', authenticate, requireRole('admin'), updateSignalementStatusRules, validateRequest, signalementController.updateSignalementStatus);

// PATCH /api/signalements/:id/escalate - Escalader en litige (admin)
router.patch('/:id/escalate', authenticate, requireRole('admin'), escaladerSignalementRules, validateRequest, signalementController.escaladerSignalement);

// DELETE /api/signalements/:id - Supprimer un signalement (admin)
router.delete('/:id', authenticate, requireRole('admin'), signalementController.deleteSignalement);

module.exports = router;
