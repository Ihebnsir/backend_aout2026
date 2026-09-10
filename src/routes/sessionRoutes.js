const express = require('express');
const router = express.Router();
const sessionController = require('../controllers/sessionController');
const { authenticate } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');
const { sessionRules, validateRequest } = require('../validators/sessionValidator');

router.get('/', authenticate, sessionController.getSessions);
router.get('/:id', authenticate, sessionController.getSessionById);
router.post('/', authenticate, requireRole('centre'), sessionRules, validateRequest, sessionController.createSession);
router.put('/:id', authenticate, requireRole('centre'), sessionRules, validateRequest, sessionController.updateSession);
router.delete('/:id', authenticate, requireRole('centre'), sessionController.deleteSession);

module.exports = router;
