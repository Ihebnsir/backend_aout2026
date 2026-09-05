const express = require('express');
const router = express.Router();
const messagingController = require('../controllers/messagingController');
const { authenticate } = require('../middleware/authMiddleware');
const requireRole = require('../middleware/roleMiddleware').requireRole;
const messageRateLimit = require('../middleware/messageRateLimitMiddleware');
const {
  validateRequest,
  listRules,
  idRules,
  directRules,
  supportRules,
  messageRules,
  statusRules,
  paginationRules,
} = require('../validators/messagingValidator');

router.get('/', authenticate, listRules, validateRequest, messagingController.listConversations);
router.get('/:id', authenticate, paginationRules, validateRequest, messagingController.getConversation);
router.post(
  '/direct',
  authenticate,
  requireRole('apprenant'),
  directRules,
  validateRequest,
  messagingController.createDirectConversation
);
router.post(
  '/support',
  authenticate,
  requireRole('apprenant'),
  supportRules,
  validateRequest,
  messagingController.createSupportConversation
);
router.post(
  '/:id/messages',
  authenticate,
  messageRateLimit,
  messageRules,
  validateRequest,
  messagingController.sendMessage
);
router.patch(
  '/:id/status',
  authenticate,
  requireRole('admin'),
  statusRules,
  validateRequest,
  messagingController.updateStatus
);
router.patch(
  '/:id/read',
  authenticate,
  idRules,
  validateRequest,
  messagingController.markRead
);

module.exports = router;
