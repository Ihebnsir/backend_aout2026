const express = require('express');

const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { authenticate } = require('../middleware/authMiddleware');
const { listNotificationsRules, validateRequest } = require('../validators/notificationValidator');

// GET /api/notifications - Lister les notifications (Authentifié)
router.get('/', authenticate, listNotificationsRules, validateRequest, notificationController.getNotifications);

// GET /api/notifications/unread-count - Obtenir le nombre de notifications non lues (Authentifié)
router.get('/unread-count', authenticate, notificationController.getUnreadCount);

// PATCH /api/notifications/:id/read - Marquer une notification comme lue (Authentifié)
router.patch('/:id/read', authenticate, notificationController.markAsRead);

// PATCH /api/notifications/read-all - Marquer toutes les notifications comme lues (Authentifié)
router.patch('/read-all', authenticate, notificationController.markAllAsRead);

// DELETE /api/notifications/:id - Supprimer une notification (Authentifié)
router.delete('/:id', authenticate, notificationController.deleteNotification);

module.exports = router;
