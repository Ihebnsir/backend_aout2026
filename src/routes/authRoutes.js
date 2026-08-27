const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticate } = require('../middleware/authMiddleware');
const { loginRules, registerRules, validateRequest } = require('../validators/authValidator');

router.post('/register', registerRules, validateRequest, authController.register);
router.post('/login', loginRules, validateRequest, authController.login);
router.get('/me', authenticate, authController.me);

module.exports = router;
