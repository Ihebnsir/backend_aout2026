const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { loginRules, validateRequest } = require('../validators/authValidator');

router.post('/login', loginRules, validateRequest, authController.login);

module.exports = router;
