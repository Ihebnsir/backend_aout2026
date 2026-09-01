const Notification = require('../models/Notification');
const createError = require('http-errors');

const sanitizeNotification = (notif) => {
  if (!notif) return null;
  const notifObj = notif.toObject ? notif.toObject() : { ...notif };
  delete notifObj.__v;
  return notifObj;
};

const buildScopeFilter = (role, userId) => {
  const filter = { role };

  if (role === 'admin') {
    filter.userId = null;
  } else {
    filter.userId = userId;
  }

  return filter;
};

const createNotification = async ({ role, userId, title, message, category }) => {
  if (role === 'admin' && userId) {
    throw createError(400, 'userId doit être null pour role admin');
  }

  if (role !== 'admin' && !userId) {
    throw createError(400, 'userId est requis pour role centre/apprenant');
  }

  const notification = await Notification.create({
    role,
    userId: role === 'admin' ? null : userId,
    title,
    message,
    category,
    lu: false,
  });

  return sanitizeNotification(notification);
};

const notifyAdmins = async (title, message, category) => {
  const notification = await Notification.create({
    role: 'admin',
    userId: null,
    title,
    message,
    category,
    lu: false,
  });

  return sanitizeNotification(notification);
};

const getNotificationsForUser = async (role, userId, { onlyUnread = false, category, page = 1, limit = 20 } = {}) => {
  const currentPage = Math.max(1, Number(page) || 1);
  const currentLimit = Math.min(100, Math.max(1, Number(limit) || 20));

  const filter = buildScopeFilter(role, userId);

  if (onlyUnread) {
    filter.lu = false;
  }

  if (category) {
    filter.category = category;
  }

  const total = await Notification.countDocuments(filter);
  const notifications = await Notification.find(filter)
    .sort({ createdAt: -1 })
    .skip((currentPage - 1) * currentLimit)
    .limit(currentLimit)
    .lean();

  return {
    data: notifications.map(sanitizeNotification),
    pagination: {
      page: currentPage,
      limit: currentLimit,
      total,
      pages: Math.max(1, Math.ceil(total / currentLimit)),
    },
  };
};

const getUnreadCount = async (role, userId) => {
  const filter = buildScopeFilter(role, userId);
  filter.lu = false;

  const count = await Notification.countDocuments(filter);
  return { count };
};

const markAsRead = async (notificationId, role, userId) => {
  const filter = buildScopeFilter(role, userId);
  filter._id = notificationId;

  const notification = await Notification.findOneAndUpdate(
    filter,
    { $set: { lu: true } },
    { new: true }
  ).lean();

  if (!notification) {
    const existing = await Notification.findById(notificationId).lean();
    if (!existing) {
      throw createError(404, 'Notification introuvable');
    }
    throw createError(403, 'Accès interdit');
  }

  return sanitizeNotification(notification);
};

const markAllAsRead = async (role, userId) => {
  const filter = buildScopeFilter(role, userId);
  filter.lu = false;

  const result = await Notification.updateMany(filter, { lu: true });
  return { updatedCount: result.modifiedCount };
};

const deleteNotification = async (notificationId, role, userId) => {
  const filter = buildScopeFilter(role, userId);
  filter._id = notificationId;

  const notification = await Notification.findOneAndDelete(filter).lean();
  if (!notification) {
    const existing = await Notification.findById(notificationId).lean();
    if (!existing) {
      throw createError(404, 'Notification introuvable');
    }
    throw createError(403, 'Accès interdit');
  }

  return { success: true };
};

module.exports = {
  createNotification,
  notifyAdmins,
  getNotificationsForUser,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
};
