const express = require('express');
const router = express.Router();
const formationController = require('../controllers/formationController');
const { authenticate } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');
const { createFormationRules, updateFormationRules, validateRequest } = require('../validators/formationValidator');

// GET /api/formations - Lister toutes les formations (public)
router.get('/', formationController.getAllFormations);

// GET /api/formations/:id - Récupérer une formation (public)
router.get('/:id', formationController.getFormationById);

// POST /api/formations - Créer une formation (centre uniquement)
router.post('/', authenticate, requireRole('centre'), createFormationRules, validateRequest, formationController.createFormation);

// PUT /api/formations/:id - Modifier une formation (propriétaire ou admin)
router.put('/:id', authenticate, requireRole('centre', 'admin'), updateFormationRules, validateRequest, formationController.updateFormation);

// DELETE /api/formations/:id - Supprimer une formation (propriétaire ou admin)
router.delete('/:id', authenticate, requireRole('centre', 'admin'), formationController.deleteFormation);

module.exports = router;
