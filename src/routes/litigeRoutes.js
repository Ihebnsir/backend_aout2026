const express = require('express');

const router = express.Router();
const litigeController = require('../controllers/litigeController');
const { authenticate } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');
const {
  createLitigeRules,
  updateLitigeStatusRules,
  assignerResponsableRules,
  ajouterMessageRules,
  ajouterPieceJointeRules,
  ajouterNoteRules,
  cloturerLitigeRules,
  listLitigesRules,
  validateRequest,
} = require('../validators/litigeValidator');

// POST /api/litiges - Créer un litige (admin)
router.post('/', authenticate, requireRole('admin'), createLitigeRules, validateRequest, litigeController.createLitige);

// GET /api/litiges - Lister tous les litiges (admin)
router.get('/', authenticate, requireRole('admin'), listLitigesRules, validateRequest, litigeController.listLitiges);

// GET /api/litiges/me - Lister mes litiges (apprenant/centre)
// IMPORTANT: /me doit être AVANT /:id pour ne pas être interprété comme un ID
router.get('/me', authenticate, litigeController.getMesLitiges);

// GET /api/litiges/:id - Consulter un litige
router.get('/:id', authenticate, litigeController.getLitigeById);

// PATCH /api/litiges/:id/status - Changer le statut (admin)
router.patch('/:id/status', authenticate, requireRole('admin'), updateLitigeStatusRules, validateRequest, litigeController.updateLitigeStatus);

// PATCH /api/litiges/:id/assign - Assigner un responsable (admin)
router.patch('/:id/assign', authenticate, requireRole('admin'), assignerResponsableRules, validateRequest, litigeController.assignerResponsable);

// POST /api/litiges/:id/messages - Ajouter un message
router.post('/:id/messages', authenticate, ajouterMessageRules, validateRequest, litigeController.ajouterMessage);

// POST /api/litiges/:id/pieces-jointes - Ajouter une pièce jointe
router.post('/:id/pieces-jointes', authenticate, ajouterPieceJointeRules, validateRequest, litigeController.ajouterPieceJointe);

// POST /api/litiges/:id/notes - Ajouter une note interne (admin)
router.post('/:id/notes', authenticate, requireRole('admin'), ajouterNoteRules, validateRequest, litigeController.ajouterNote);

// PATCH /api/litiges/:id/cloturer - Clôturer un litige (admin)
router.patch('/:id/cloturer', authenticate, requireRole('admin'), cloturerLitigeRules, validateRequest, litigeController.cloturerLitige);

// PATCH /api/litiges/:id/archiver - Archiver un litige (admin)
router.patch('/:id/archiver', authenticate, requireRole('admin'), litigeController.archiverLitige);

module.exports = router;
