const express = require('express');
const router = express.Router();
const attendanceController = require('../controllers/attendanceController');
const { authenticate } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');
const { attendanceRules, validateRequest } = require('../validators/attendanceValidator');

router.get('/', authenticate, attendanceController.getAttendance);
router.get('/me', authenticate, requireRole('apprenant'), attendanceController.getMyAttendance);
router.get('/:id', authenticate, attendanceController.getAttendanceById);
router.post('/', authenticate, requireRole('centre'), attendanceRules, validateRequest, attendanceController.createAttendance);
router.put('/:id', authenticate, requireRole('centre'), attendanceRules, validateRequest, attendanceController.updateAttendance);
router.get('/session/:sessionId', authenticate, requireRole('centre'), attendanceController.getSessionAttendance);

module.exports = router;
