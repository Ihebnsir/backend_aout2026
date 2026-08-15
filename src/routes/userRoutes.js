const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticate } = require('../middleware/authMiddleware');
const { requireRole, allowOwnerOrAdmin } = require('../middleware/roleMiddleware');
const { createUserRules, updateUserRules, validateRequest } = require('../validators/userValidator');

router.get('/', authenticate, requireRole('admin'), userController.getAllUsers);
router.get('/:id', authenticate, allowOwnerOrAdmin, userController.getUserById);
router.post('/', authenticate, createUserRules, validateRequest, userController.createUser);
router.patch('/:id', authenticate, allowOwnerOrAdmin, updateUserRules, validateRequest, userController.updateUser);
router.delete('/:id', authenticate, requireRole('admin'), userController.deleteUser);

module.exports = router;
