const createError = require('http-errors');
const mongoose = require('mongoose');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const User = require('../models/User');
const Centre = require('../models/Centre');
const Formation = require('../models/Formation');
const notificationService = require('./notificationService');

let emitMessage = () => {};

const setMessageEmitter = (emitter) => {
  emitMessage = typeof emitter === 'function' ? emitter : () => {};
};

const normalizePage = (page, limit) => ({
  page: Math.max(1, Number(page) || 1),
  limit: Math.min(100, Math.max(1, Number(limit) || 20)),
});

const userIdString = (id) => (id?._id || id).toString();

const safeUserSelect = 'nom prenom email role avatar';
const conversationPopulate = [
  { path: 'learnerUserId', select: safeUserSelect },
  { path: 'centreUserId', select: safeUserSelect },
  { path: 'centreId', select: 'name logo ville' },
  { path: 'formationId', select: 'title image category price' },
];

const serializeConversation = (conversation, userId) => {
  const result = conversation.toObject ? conversation.toObject() : { ...conversation };
  const unreadCounts = result.unreadCounts instanceof Map
    ? Object.fromEntries(result.unreadCounts.entries())
    : result.unreadCounts || {};
  result.unreadCount = Number(unreadCounts[userIdString(userId)] || 0);
  delete result.unreadCounts;
  return result;
};

const serializeMessage = (message) => {
  const result = message.toObject ? message.toObject() : { ...message };
  delete result.__v;
  return result;
};

const requireActiveUser = async (id, role) => {
  const user = await User.findOne({ _id: id, role, status: 'active' }).select('_id role status').lean();
  if (!user) {
    throw createError(403, 'Compte non autorisé pour la messagerie');
  }
  return user;
};

const validateDirectTarget = async (learnerId, centreId, formationId) => {
  await requireActiveUser(learnerId, 'apprenant');

  if (!mongoose.Types.ObjectId.isValid(centreId)) {
    throw createError(400, 'centreId invalide');
  }
  const centre = await Centre.findById(centreId).select('_id userId').lean();
  if (!centre) {
    throw createError(404, 'Centre introuvable');
  }

  const centreUser = await User.findOne({ _id: centre.userId, role: 'centre', status: 'active' })
    .select('_id role status')
    .lean();
  if (!centreUser) {
    throw createError(403, 'Compte centre non autorisé');
  }

  let formation = null;
  if (formationId !== undefined && formationId !== null && formationId !== '') {
    if (!mongoose.Types.ObjectId.isValid(formationId)) {
      throw createError(400, 'formationId invalide');
    }
    formation = await Formation.findOne({ _id: formationId, centre: centre._id })
      .select('_id centre title')
      .lean();
    if (!formation) {
      throw createError(400, 'La formation ne correspond pas au centre');
    }
  }

  return { centre, centreUser, formation };
};

const conversationFilterForUser = (user) => {
  if (user.role === 'admin') return { type: 'support' };
  if (user.role === 'apprenant') return { learnerUserId: user.id };
  if (user.role === 'centre') return { centreUserId: user.id, type: 'direct' };
  throw createError(403, 'Rôle non autorisé');
};

const findAccessibleConversation = async (conversationId, user) => {
  if (!mongoose.Types.ObjectId.isValid(conversationId)) {
    throw createError(400, 'ID conversation invalide');
  }
  const filter = { _id: conversationId, ...conversationFilterForUser(user) };
  const conversation = await Conversation.findOne(filter).populate(conversationPopulate);
  if (!conversation) {
    throw createError(404, 'Conversation introuvable');
  }
  return conversation;
};

const listConversations = async (user, { page, limit, search, type, status, formationId } = {}) => {
  const pagination = normalizePage(page, limit);
  const filter = conversationFilterForUser(user);

  if (type) {
    if (!['direct', 'support'].includes(type)) throw createError(400, 'type invalide');
    filter.type = type;
  }
  if (status) {
    if (!['open', 'pending', 'resolved', 'closed'].includes(status)) throw createError(400, 'status invalide');
    filter.status = status;
  }
  if (formationId) {
    if (!mongoose.Types.ObjectId.isValid(formationId)) throw createError(400, 'formationId invalide');
    filter.formationId = formationId;
  }

  if (search && search.trim()) {
    const expression = new RegExp(search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const [users, formations] = await Promise.all([
      User.find({ $or: [{ nom: expression }, { prenom: expression }, { email: expression }] }).select('_id').lean(),
      Formation.find({ title: expression }).select('_id').lean(),
    ]);
    filter.$or = [
      { subject: expression },
      { learnerUserId: { $in: users.map((item) => item._id) } },
      { centreUserId: { $in: users.map((item) => item._id) } },
      { formationId: { $in: formations.map((item) => item._id) } },
    ];
  }

  const [total, conversations] = await Promise.all([
    Conversation.countDocuments(filter),
    Conversation.find(filter)
      .populate(conversationPopulate)
      .sort({ lastMessageAt: -1, updatedAt: -1 })
      .skip((pagination.page - 1) * pagination.limit)
      .limit(pagination.limit)
      .lean(),
  ]);

  return {
    data: conversations.map((conversation) => serializeConversation(conversation, user.id)),
    pagination: {
      ...pagination,
      total,
      pages: Math.max(1, Math.ceil(total / pagination.limit)),
    },
  };
};

const getConversation = async (conversationId, user, { page, limit } = {}) => {
  const conversation = await findAccessibleConversation(conversationId, user);
  const pagination = normalizePage(page, limit);
  const filter = { conversationId: conversation._id };
  const [total, messages] = await Promise.all([
    Message.countDocuments(filter),
    Message.find(filter)
      .populate('senderId', safeUserSelect)
      .sort({ createdAt: 1, _id: 1 })
      .skip((pagination.page - 1) * pagination.limit)
      .limit(pagination.limit)
      .lean(),
  ]);

  return {
    conversation: serializeConversation(conversation, user.id),
    messages: messages.map(serializeMessage),
    pagination: {
      ...pagination,
      total,
      pages: Math.max(1, Math.ceil(total / pagination.limit)),
    },
  };
};

const createInitialMessage = async (conversation, sender, content) => {
  if (!content) return null;
  return createMessage(conversation, sender, content, null);
};

const createDirectConversation = async (learnerId, { centreId, formationId, initialMessage } = {}) => {
  const { centre, centreUser, formation } = await validateDirectTarget(learnerId, centreId, formationId);
  const directKey = [learnerId, centreUser._id, formation?._id || 'none'].join(':');
  let conversation;
  try {
    conversation = await Conversation.findOneAndUpdate(
      { directKey },
      {
        $setOnInsert: {
          type: 'direct',
          learnerUserId: learnerId,
          centreUserId: centreUser._id,
          centreId: centre._id,
          formationId: formation?._id || null,
          directKey,
          status: null,
          unreadCounts: {},
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  } catch (error) {
    if (error.code !== 11000) throw error;
    conversation = await Conversation.findOne({ directKey });
  }

  let message = null;
  if (initialMessage) {
    message = await createInitialMessage(conversation, { id: learnerId, role: 'apprenant' }, initialMessage);
  }
  await conversation.populate(conversationPopulate);
  return { conversation: serializeConversation(conversation, learnerId), message };
};

const createSupportConversation = async (learnerId, { subject, initialMessage } = {}) => {
  await requireActiveUser(learnerId, 'apprenant');
  const activeSupportKey = `support:${learnerId}`;
  let conversation;
  try {
    conversation = await Conversation.findOneAndUpdate(
      { activeSupportKey },
      {
        $setOnInsert: {
          type: 'support',
          learnerUserId: learnerId,
          subject: subject || null,
          status: 'open',
          activeSupportKey,
          unreadCounts: {},
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  } catch (error) {
    if (error.code !== 11000) throw error;
    conversation = await Conversation.findOne({ activeSupportKey });
  }

  let message = null;
  if (initialMessage) {
    message = await createInitialMessage(conversation, { id: learnerId, role: 'apprenant' }, initialMessage);
  }
  await conversation.populate(conversationPopulate);
  return { conversation: serializeConversation(conversation, learnerId), message };
};

const notifyNewMessage = async (conversation, sender, message) => {
  const preview = message.content.length > 120 ? `${message.content.slice(0, 117)}...` : message.content;
  try {
    if (conversation.type === 'direct') {
      const recipientId = sender.role === 'apprenant' ? conversation.centreUserId : conversation.learnerUserId;
      const recipientRole = sender.role === 'apprenant' ? 'centre' : 'apprenant';
      await notificationService.createNotification({
        role: recipientRole,
        userId: recipientId,
        title: 'Nouveau message',
        message: preview,
        category: 'messages',
      });
    } else if (sender.role === 'apprenant') {
      await notificationService.notifyAdmins('Nouveau message de support', preview, 'messages');
    } else if (sender.role === 'admin') {
      await notificationService.createNotification({
        role: 'apprenant',
        userId: conversation.learnerUserId,
        title: 'Réponse du support',
        message: preview,
        category: 'messages',
      });
    }
  } catch (error) {
    // Messaging remains successful if notification delivery fails.
  }
};

const createMessage = async (conversation, sender, content, clientMessageId) => {
  const trimmedContent = typeof content === 'string' ? content.trim() : '';
  if (!trimmedContent) throw createError(400, 'content est obligatoire');
  if (trimmedContent.length > 5000) throw createError(400, 'content ne doit pas dépasser 5000 caractères');
  if (conversation.type === 'support' && conversation.status === 'closed') {
    throw createError(409, 'Cette conversation est fermée');
  }

  const senderId = sender.id;
  const senderRole = sender.role;
  if (clientMessageId) {
    const existing = await Message.findOne({ conversationId: conversation._id, clientMessageId })
      .populate('senderId', safeUserSelect);
    if (existing) {
      if (userIdString(existing.senderId) !== userIdString(senderId)) {
        throw createError(409, 'clientMessageId déjà utilisé par un autre expéditeur');
      }
      return { message: existing, duplicate: true };
    }
  }

  let message;
  try {
    const messagePayload = {
      conversationId: conversation._id,
      senderId,
      senderRole,
      content: trimmedContent,
    };
    if (clientMessageId) messagePayload.clientMessageId = clientMessageId;
    message = await Message.create(messagePayload);
  } catch (error) {
    if (error.code !== 11000 || !clientMessageId) throw error;
    const existing = await Message.findOne({ conversationId: conversation._id, clientMessageId })
      .populate('senderId', safeUserSelect);
    if (existing && userIdString(existing.senderId) !== userIdString(senderId)) {
      throw createError(409, 'clientMessageId déjà utilisé par un autre expéditeur');
    }
    return { message: existing, duplicate: true };
  }

  const recipientIds = [conversation.learnerUserId, conversation.centreUserId]
    .filter(Boolean)
    .map(userIdString)
    .filter((id) => id !== userIdString(senderId));
  if (conversation.type === 'support' && sender.role === 'apprenant') {
    const admins = await User.find({ role: 'admin', status: 'active' }).select('_id').lean();
    recipientIds.push(...admins.map((admin) => userIdString(admin._id)));
  }
  const unreadUpdate = { $set: {
    lastMessage: {
      messageId: message._id,
      senderId,
      contentPreview: trimmedContent.slice(0, 200),
      createdAt: message.createdAt,
    },
    lastMessageAt: message.createdAt,
  } };
  for (const recipientId of recipientIds) {
    unreadUpdate.$inc = unreadUpdate.$inc || {};
    unreadUpdate.$inc[`unreadCounts.${recipientId}`] = 1;
  }
  await Conversation.updateOne({ _id: conversation._id }, unreadUpdate);

  await notifyNewMessage(conversation, sender, message);
  emitMessage(conversation, message);
  await message.populate('senderId', safeUserSelect);
  return { message, duplicate: false };
};

const sendMessage = async (conversationId, user, content, clientMessageId) => {
  const conversation = await findAccessibleConversation(conversationId, user);
  if (user.role === 'centre' && conversation.type !== 'direct') {
    throw createError(403, 'Accès interdit');
  }
  return createMessage(conversation, user, content, clientMessageId);
};

const updateSupportStatus = async (conversationId, status, user) => {
  if (user.role !== 'admin') throw createError(403, 'Accès interdit');
  if (!['open', 'pending', 'resolved', 'closed'].includes(status)) {
    throw createError(400, 'status invalide');
  }
  const conversation = await Conversation.findOne({ _id: conversationId, type: 'support' });
  if (!conversation) throw createError(404, 'Conversation introuvable');
  const allowedTransitions = {
    open: ['pending', 'resolved', 'closed'],
    pending: ['open', 'resolved', 'closed'],
    resolved: ['open', 'closed'],
    closed: ['open'],
  };
  if (conversation.status !== status && !allowedTransitions[conversation.status]?.includes(status)) {
    throw createError(400, `Transition de statut invalide : ${conversation.status} → ${status}`);
  }
  conversation.status = status;
  conversation.activeSupportKey = ['open', 'pending'].includes(status)
    ? `support:${conversation.learnerUserId}`
    : null;
  await conversation.save();
  await conversation.populate(conversationPopulate);
  return serializeConversation(conversation, user.id);
};

const markRead = async (conversationId, user) => {
  const conversation = await findAccessibleConversation(conversationId, user);
  await Conversation.updateOne(
    { _id: conversation._id },
    { $set: { [`unreadCounts.${userIdString(user.id)}`]: 0 } }
  );
  conversation.unreadCounts.set(userIdString(user.id), 0);
  return serializeConversation(conversation, user.id);
};

const canAccessConversation = async (conversationId, user) => {
  try {
    await findAccessibleConversation(conversationId, user);
    return true;
  } catch (error) {
    if ([400, 403, 404].includes(error.status)) return false;
    throw error;
  }
};

module.exports = {
  setMessageEmitter,
  listConversations,
  getConversation,
  createDirectConversation,
  createSupportConversation,
  sendMessage,
  updateSupportStatus,
  markRead,
  canAccessConversation,
};
