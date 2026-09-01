const express = require('express');

const router = express.Router();
const certificationController = require('../controllers/certificationController');
const { authenticate } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');
const { createCertificationRules, verifyCertificationRules, validateRequest } = require('../validators/certificationValidator');

// POST /api/certifications - Créer une certification (Admin)
router.post('/', authenticate, requireRole('admin'), createCertificationRules, validateRequest, certificationController.createCertification);

// GET /api/certifications - Lister mes certifications (Apprenant)
router.get('/', authenticate, requireRole('apprenant'), certificationController.getMyCertifications);

// GET /api/certifications/verify/:numeroCertificat - Vérifier une certification (Public, sans auth)
router.get('/verify/:numeroCertificat', verifyCertificationRules, validateRequest, certificationController.verifyCertification);

// GET /api/certifications/:id - Récupérer une certification (Apprenant propriétaire ou Admin)
router.get('/:id', authenticate, certificationController.getCertificationById);

// PATCH /api/certifications/:id/revoke - Révoquer une certification (Admin)
router.patch('/:id/revoke', authenticate, requireRole('admin'), certificationController.revokeCertification);

module.exports = router;
