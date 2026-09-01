const express = require('express');

const router = express.Router();
const noteController = require('../controllers/noteController');
const { authenticate } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');
const { createNoteRules, updateNoteRules, validateRequest } = require('../validators/noteValidator');

// POST /api/notes - Créer une note (Apprenant)
router.post('/', authenticate, requireRole('apprenant'), createNoteRules, validateRequest, noteController.createNote);

// GET /api/notes/:centreId/average - Obtenir la moyenne des notes (Public)
router.get('/:centreId/average', noteController.getAverageNote);

// GET /api/notes/:id - Récupérer une note spécifique (Auteur ou Admin)
router.get('/:id', authenticate, noteController.getNoteById);

// GET /api/notes/:centreId - Lister les notes d'un centre (Public)
router.get('/:centreId', noteController.getNotesBycentre);

// PATCH /api/notes/:id - Modifier une note (Auteur)
router.patch('/:id', authenticate, requireRole('apprenant'), updateNoteRules, validateRequest, noteController.updateNote);

// DELETE /api/notes/:id - Supprimer une note (Auteur)
router.delete('/:id', authenticate, requireRole('apprenant'), noteController.deleteNote);

module.exports = router;
