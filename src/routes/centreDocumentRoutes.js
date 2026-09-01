const express = require('express');

const router = express.Router();
const centreDocumentController = require('../controllers/centreDocumentController');
const { authenticate } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');
const { uploadDocumentRules, validateRequest } = require('../validators/centreDocumentValidator');

// POST /api/centre-documents - Upload document (Centre)
router.post('/', authenticate, requireRole('centre'), uploadDocumentRules, validateRequest, centreDocumentController.uploadDocument);

// GET /api/centre-documents - Lister mes documents (Centre)
router.get('/', authenticate, requireRole('centre'), centreDocumentController.getMyDocuments);

// GET /api/centre-documents/:id - Récupérer un document (Centre propriétaire ou Admin)
router.get('/:id', authenticate, centreDocumentController.getDocumentById);

// PATCH /api/centre-documents/:id/validate - Valider un document (Admin)
router.patch('/:id/validate', authenticate, requireRole('admin'), centreDocumentController.validateDocument);

// PATCH /api/centre-documents/:id/reject - Rejeter un document (Admin)
router.patch('/:id/reject', authenticate, requireRole('admin'), centreDocumentController.rejectDocument);

// DELETE /api/centre-documents/:id - Supprimer un document (Centre propriétaire ou Admin)
router.delete('/:id', authenticate, centreDocumentController.deleteDocument);

module.exports = router;
