const mongoose = require('mongoose');
const createError = require('http-errors');
const Attachment = require('../models/Attachment');
const { writeAttachmentFile, safeAttachmentUrl, readAttachmentFile, readAttachmentObject, deleteStoredAttachment, getLocalAttachmentPath } = require('./attachmentStorage');

const normalizeAttachmentMetadata = (attachment) => {
  if (!attachment) return null;
  const record = attachment.toObject ? attachment.toObject() : { ...attachment };
  delete record.__v;
  return {
    id: record._id,
    originalName: record.originalName,
    storedName: record.storedName,
    storageKey: record.storageKey,
    storageProvider: record.storageProvider || 'local',
    mimeType: record.mimeType,
    size: record.size,
    url: record.url,
    createdAt: record.createdAt,
    conversationId: record.conversationId,
    uploaderId: record.uploaderId,
  };
};

const createAttachmentRecord = async ({ conversationId, uploaderId, buffer, originalName, mimeType, storageKey }) => {
  const fileMeta = await writeAttachmentFile({
    conversationId: conversationId.toString(),
    userId: uploaderId.toString(),
    originalName,
    mimeType,
    buffer,
  });

  try {
    const attachment = await Attachment.create({
      conversationId,
      uploaderId,
      originalName: fileMeta.originalName,
      storedName: fileMeta.storedName,
      storageKey: fileMeta.storageKey,
      storageProvider: fileMeta.provider,
      mimeType: fileMeta.mimeType,
      size: fileMeta.size,
      url: safeAttachmentUrl(conversationId.toString(), new mongoose.Types.ObjectId().toString()),
    });
    attachment.url = safeAttachmentUrl(conversationId.toString(), attachment._id.toString());
    await attachment.save();
    return normalizeAttachmentMetadata(attachment);
  } catch (error) {
    await deleteStoredAttachment({ storageProvider: fileMeta.provider, storageKey: fileMeta.storageKey, storedName: fileMeta.storedName }).catch(() => undefined);
    throw error;
  }
};

const getAttachmentById = async (attachmentId, conversationId) => {
  if (!mongoose.Types.ObjectId.isValid(attachmentId)) {
    throw createError(404, 'Pièce jointe introuvable');
  }

  const attachment = await Attachment.findOne({ _id: attachmentId, conversationId }).lean();
  if (!attachment) {
    throw createError(404, 'Pièce jointe introuvable');
  }

  return attachment;
};

const getAttachmentFilePath = (attachment) => getLocalAttachmentPath(attachment);

const getAttachmentContent = async (attachment) => {
  if (attachment.storageProvider === 'r2') {
    const result = await readAttachmentObject(attachment.storageKey);
    return { content: result.content, contentType: result.contentType };
  }
  const filePath = getAttachmentFilePath(attachment);
  return { content: await readAttachmentFile(filePath), filePath };
};

const deleteAttachment = async (attachment) => {
  await deleteStoredAttachment(attachment);
  await Attachment.deleteOne({ _id: attachment._id });
};

const canUseAttachmentForConversation = (attachment, conversationId) => {
  if (!attachment || !conversationId) return false;
  return attachment.conversationId.toString() === conversationId.toString();
};

module.exports = {
  createAttachmentRecord,
  getAttachmentById,
  getAttachmentContent,
  deleteAttachment,
  normalizeAttachmentMetadata,
  canUseAttachmentForConversation,
  getAttachmentFilePath,
};
