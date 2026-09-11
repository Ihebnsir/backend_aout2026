const createError = require('http-errors');
const Conversation = require('../models/Conversation');
const attachmentService = require('../services/attachmentService');

const canAccessConversation = async (conversationId, user) => {
  const baseFilter = { _id: conversationId };
  if (user.role === 'admin') {
    return Conversation.findOne({ ...baseFilter, type: 'support' }).lean();
  }
  return Conversation.findOne({
    ...baseFilter,
    $or: [{ learnerUserId: user.id }, { centreUserId: user.id }],
  }).lean();
};

const uploadAttachment = async (req, res, next) => {
  try {
    if (!req.file) {
      throw createError(400, 'Fichier requis');
    }

    const conversationId = req.params.id;
    const conversation = await canAccessConversation(conversationId, req.user);

    if (!conversation) {
      throw createError(403, 'Accès interdit');
    }

    if (req.user.role === 'centre' && conversation.type !== 'direct') {
      throw createError(403, 'Accès interdit');
    }

    const attachment = await attachmentService.createAttachmentRecord({
      conversationId: conversation._id,
      uploaderId: req.user.id,
      buffer: req.file.buffer,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
    });

    return res.status(201).json({
      success: true,
      message: 'Pièce jointe uploadée',
      data: { attachment },
    });
  } catch (error) {
    return next(error);
  }
};

const downloadAttachment = async (req, res, next) => {
  try {
    const { conversationId, attachmentId } = req.params;
    const conversation = await canAccessConversation(conversationId, req.user);

    if (!conversation) {
      throw createError(404, 'Conversation introuvable');
    }

    const attachment = await attachmentService.getAttachmentById(attachmentId, conversationId);
    const { content, contentType } = await attachmentService.getAttachmentContent(attachment);

    res.setHeader('Content-Type', contentType || attachment.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${attachment.originalName}"`);
    res.setHeader('Content-Length', String(content.length));
    return res.send(content);
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  uploadAttachment,
  downloadAttachment,
};
