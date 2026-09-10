const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticate } = require('../middleware/authMiddleware');
const {
	loginRules,
	registerRules,
	forgotPasswordRules,
	verifyResetCodeRules,
	resetPasswordRules,
	validateRequest,
} = require('../validators/authValidator');

router.post('/register', registerRules, validateRequest, authController.register);
router.post('/login', loginRules, validateRequest, authController.login);
router.post('/forgot-password', forgotPasswordRules, validateRequest, authController.forgotPassword);
router.post('/verify-reset-code', verifyResetCodeRules, validateRequest, authController.verifyResetCode);
router.post('/reset-password', resetPasswordRules, validateRequest, authController.resetPassword);
router.get('/me', authenticate, authController.me);

module.exports = router;
