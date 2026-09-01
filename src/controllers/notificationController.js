const createError = require('http-errors');
const mongoose = require('mongoose');
const notificationService = require('../services/notificationService');

const ensureId = (id) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw createError(400, 'ID invalide');
  }
};

const getNotifications = async (req, res, next) => {
  try {
    const { onlyUnread, category, page, limit } = req.query;

    const result = await notificationService.getNotificationsForUser(req.user.role, req.user.id, {
      onlyUnread: onlyUnread === 'true',
      category,
      page,
      limit,
    });

    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    return next(error);
  }
};

const getUnreadCount = async (req, res, next) => {
  try {
    const count = await notificationService.getUnreadCount(req.user.role, req.user.id);

    return res.status(200).json({ success: true, data: count });
  } catch (error) {
    return next(error);
  }
};

const markAsRead = async (req, res, next) => {
  try {
    ensureId(req.params.id);

    const notification = await notificationService.markAsRead(req.params.id, req.user.role, req.user.id);

    return res.status(200).json({
      success: true,
      message: 'Notification marquée comme lue',
      data: notification,
    });
  } catch (error) {
    return next(error);
  }
};

const markAllAsRead = async (req, res, next) => {
  try {
    const result = await notificationService.markAllAsRead(req.user.role, req.user.id);

    return res.status(200).json({
      success: true,
      message: 'Toutes les notifications marquées comme lues',
      data: result,
    });
  } catch (error) {
    return next(error);
  }
};

const deleteNotification = async (req, res, next) => {
  try {
    ensureId(req.params.id);

    await notificationService.deleteNotification(req.params.id, req.user.role, req.user.id);

    return res.status(200).json({
      success: true,
      message: 'Notification supprimée',
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
};
