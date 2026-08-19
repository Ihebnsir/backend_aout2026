const express = require('express');
const router = express.Router();
const centreController = require('../controllers/centreController');
const { authenticate } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');
const { createCentreRules, updateCentreRules, validateRequest } = require('../validators/centreValidator');

router.get('/', centreController.getAllCentres);
router.get('/me', authenticate, requireRole('centre'), centreController.getMyCentre);
router.get('/:id', centreController.getCentreById);
router.post('/', authenticate, requireRole('centre'), createCentreRules, validateRequest, centreController.createCentre);
router.patch('/:id', authenticate, requireRole('centre', 'admin'), updateCentreRules, validateRequest, centreController.updateCentre);
router.delete('/:id', authenticate, requireRole('admin'), centreController.deleteCentre);
router.patch('/:id/verify', authenticate, requireRole('admin'), centreController.verifyCentre);
router.patch('/:id/reject', authenticate, requireRole('admin'), centreController.rejectCentre);
router.patch('/:id/suspend', authenticate, requireRole('admin'), centreController.suspendCentre);

module.exports = router;