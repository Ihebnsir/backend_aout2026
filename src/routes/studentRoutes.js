const express = require('express');
const router = express.Router();
const studentController = require('../controllers/studentController');
const { authenticate } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');

router.get('/me/students', authenticate, requireRole('centre'), studentController.getMyStudents);

module.exports = router;
