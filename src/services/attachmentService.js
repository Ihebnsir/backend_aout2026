const mongoose = require('mongoose');
const path = require('path');
const createError = require('http-errors');
const Attachment = require('../models/Attachment');
const { writeAttachmentFile, safeAttachmentUrl, readAttachmentFile, deleteAttachmentFile, getAttachmentConfig } = require('./attachmentStorage');

const normalizeAttachmentMetadata = (attachment) => {
  if (!attachment) return null;
  const record = attachment.toObject ? attachment.toObject() : { ...attachment };
  delete record.__v;
  return {
    id: record._id,
    originalName: record.originalName,
    storedName: record.storedName,
    storageKey: record.storageKey,
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

  const attachment = await Attachment.create({
    conversationId,
    uploaderId,
    originalName: fileMeta.originalName,
    storedName: fileMeta.storedName,
    storageKey: fileMeta.storageKey,
    mimeType: fileMeta.mimeType,
    size: fileMeta.size,
    url: safeAttachmentUrl(conversationId.toString(), new mongoose.Types.ObjectId().toString()),
  });

  const finalUrl = safeAttachmentUrl(conversationId.toString(), attachment._id.toString());
  attachment.url = finalUrl;
  await attachment.save();

  return normalizeAttachmentMetadata(attachment);
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

const getAttachmentFilePath = (attachment) => {
  const { storageRoot } = getAttachmentConfig();
  const raw = attachment.storageKey || attachment.storedName;
  const relativePath = String(raw).replace(/\\/g, '/');
  const safeRelative = relativePath.split('/').filter(Boolean).join('/');
  if (!safeRelative || safeRelative.startsWith('..') || safeRelative.includes('../')) {
    throw createError(400, 'Chemin de pièce jointe invalide');
  }
  return path.join(storageRoot, safeRelative);
};

const getAttachmentContent = async (attachment) => {
  const filePath = getAttachmentFilePath(attachment);
  const content = await readAttachmentFile(filePath);
  return { content, filePath };
};

const deleteAttachment = async (attachment) => {
  const filePath = getAttachmentFilePath(attachment);
  await deleteAttachmentFile(filePath);
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
