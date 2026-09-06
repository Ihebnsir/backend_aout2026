const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const createError = require('http-errors');

const DEFAULT_ALLOWED_MIME_TYPES = {
  'application/pdf': 'pdf',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'text/plain': 'txt',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.ms-powerpoint': 'ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
};

const getAttachmentConfig = () => {
  const storageRoot = process.env.ATTACHMENT_STORAGE_DIR || path.join(process.cwd(), '.attachments');
  const maxSize = Number(process.env.MAX_ATTACHMENT_SIZE || 10 * 1024 * 1024);
  const maxPerMessage = Number(process.env.MAX_ATTACHMENTS_PER_MESSAGE || 5);
  return {
    storageRoot,
    maxSize: Number.isFinite(maxSize) && maxSize > 0 ? maxSize : 10 * 1024 * 1024,
    maxPerMessage: Number.isFinite(maxPerMessage) && maxPerMessage > 0 ? maxPerMessage : 5,
    allowedMimeTypes: DEFAULT_ALLOWED_MIME_TYPES,
  };
};

const sanitizeOriginalName = (originalName) => {
  const safeName = String(originalName || 'upload').replace(/[\\/]+/g, ' ').trim();
  const base = path.basename(safeName) || 'upload';
  return base.replace(/\s+/g, ' ');
};

const buildStorageKey = (conversationId, userId, originalName, mimeType) => {
  const ext = DEFAULT_ALLOWED_MIME_TYPES[mimeType] || 'bin';
  const random = crypto.randomBytes(12).toString('hex');
  const opaqueBase = `attachment-${Date.now()}-${random}`;
  return `conversations/${conversationId}/${userId}/${opaqueBase}.${ext}`;
};

const getConversationStorageDir = (conversationId, userId) => {
  const config = getAttachmentConfig();
  const base = path.resolve(config.storageRoot);
  const dir = path.join(base, 'conversations', conversationId.toString(), userId.toString());
  fs.mkdirSync(dir, { recursive: true, mode: 0o755 });
  return dir;
};

const validateMimeType = (mimeType) => {
  if (!mimeType || !Object.prototype.hasOwnProperty.call(DEFAULT_ALLOWED_MIME_TYPES, mimeType)) {
    throw createError(400, 'Type de fichier non pris en charge');
  }
};

const validateFileSize = (size) => {
  const { maxSize } = getAttachmentConfig();
  if (size <= 0) throw createError(400, 'Fichier vide');
  if (size > maxSize) throw createError(400, `Fichier trop volumineux (max ${maxSize} octets)`);
};

const ensureSafeStoragePath = (storageKey) => {
  const normalized = path.posix.normalize(String(storageKey || '').replace(/\\/g, '/'));
  if (!normalized || normalized === '.' || normalized.startsWith('../') || normalized.includes('/../') || normalized.includes('..')) {
    throw createError(400, 'Chemin de stockage invalide');
  }
  return normalized;
};

const writeAttachmentFile = async ({ conversationId, userId, originalName, mimeType, buffer }) => {
  validateMimeType(mimeType);
  validateFileSize(buffer.length);

  const safeOriginalName = sanitizeOriginalName(originalName);
  const storageKey = ensureSafeStoragePath(buildStorageKey(conversationId, userId, safeOriginalName, mimeType));
  const dir = getConversationStorageDir(conversationId, userId);
  const fileName = path.basename(storageKey);
  const filePath = path.join(dir, fileName);

  if (filePath.includes('..')) {
    throw createError(400, 'Nom de fichier invalide');
  }

  await fs.promises.writeFile(filePath, buffer, { flag: 'w', mode: 0o600 });

  return {
    originalName: safeOriginalName,
    storedName: fileName,
    storageKey,
    mimeType,
    size: buffer.length,
    absolutePath: filePath,
  };
};

const readAttachmentFile = async (filePath) => {
  try {
    return await fs.promises.readFile(filePath);
  } catch (error) {
    throw createError(404, 'Fichier introuvable');
  }
};

const safeAttachmentUrl = (conversationId, attachmentId) => `/api/conversations/${conversationId}/attachments/${attachmentId}`;

const deleteAttachmentFile = async (filePath) => {
  try {
    await fs.promises.unlink(filePath);
  } catch (error) {
    // Ignore cleanup errors, but preserve ownership and conversation checks.
  }
};

module.exports = {
  getAttachmentConfig,
  sanitizeOriginalName,
  buildStorageKey,
  validateMimeType,
  validateFileSize,
  ensureSafeStoragePath,
  writeAttachmentFile,
  readAttachmentFile,
  safeAttachmentUrl,
  deleteAttachmentFile,
  DEFAULT_ALLOWED_MIME_TYPES,
};
