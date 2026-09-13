const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const createError = require('http-errors');
const { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } = require('@aws-sdk/client-s3');
const supabase = require('@supabase/supabase-js');

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

let r2Client;
let supabaseClient;
let supabaseClientConfig;

const getAttachmentConfig = () => {
  const provider = String(process.env.ATTACHMENT_STORAGE_PROVIDER || 'local').toLowerCase();
  const storageRoot = process.env.ATTACHMENT_STORAGE_DIR || path.join(process.cwd(), '.attachments');
  const maxSize = Number(process.env.MAX_ATTACHMENT_SIZE || 10 * 1024 * 1024);
  const maxPerMessage = Number(process.env.MAX_ATTACHMENTS_PER_MESSAGE || 5);
  return {
    provider,
    storageRoot,
    maxSize: Number.isFinite(maxSize) && maxSize > 0 ? maxSize : 10 * 1024 * 1024,
    maxPerMessage: Number.isFinite(maxPerMessage) && maxPerMessage > 0 ? maxPerMessage : 5,
    allowedMimeTypes: DEFAULT_ALLOWED_MIME_TYPES,
  };
};

const validateStorageConfig = () => {
  const { provider } = getAttachmentConfig();
  if (!['local', 'r2', 'supabase'].includes(provider)) {
    throw createError(500, 'ATTACHMENT_STORAGE_PROVIDER doit être local, r2 ou supabase');
  }
  if (provider === 'r2') {
    const required = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET_NAME', 'R2_ENDPOINT'];
    const missing = required.filter((key) => !process.env[key]?.trim());
    if (missing.length) throw createError(500, `Configuration R2 incomplète: ${missing.join(', ')}`);
  }
  if (provider === 'supabase') {
    const required = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_STORAGE_BUCKET'];
    const missing = required.filter((key) => !process.env[key]?.trim());
    if (missing.length) throw createError(500, `Configuration Supabase incomplète: ${missing.join(', ')}`);
  }
  return provider;
};

const getR2Client = () => {
  validateStorageConfig();
  if (!r2Client) {
    r2Client = new S3Client({
      region: 'auto',
      endpoint: process.env.R2_ENDPOINT,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      },
    });
  }
  return r2Client;
};

const getSupabaseClient = () => {
  validateStorageConfig();
  const config = `${process.env.SUPABASE_URL}\n${process.env.SUPABASE_SERVICE_ROLE_KEY}`;
  if (!supabaseClient || supabaseClientConfig !== config) {
    supabaseClient = supabase.createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    supabaseClientConfig = config;
  }
  return supabaseClient;
};

const sanitizeOriginalName = (originalName) => {
  const safeName = String(originalName || 'upload').replace(/[\\/]+/g, ' ').trim();
  const base = path.basename(safeName) || 'upload';
  return base.replace(/["\r\n]/g, '').replace(/\s+/g, ' ') || 'upload';
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
  const provider = validateStorageConfig();
  validateMimeType(mimeType);
  validateFileSize(buffer.length);

  const safeOriginalName = sanitizeOriginalName(originalName);
  const storageKey = ensureSafeStoragePath(buildStorageKey(conversationId, userId, safeOriginalName, mimeType));
  const fileName = path.basename(storageKey);

  if (provider === 'r2') {
    await getR2Client().send(new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: storageKey,
      Body: buffer,
      ContentType: mimeType,
    }));
    return {
      provider: 'r2',
      originalName: safeOriginalName,
      storedName: fileName,
      storageKey,
      mimeType,
      size: buffer.length,
    };
  }

  if (provider === 'supabase') {
    const { error } = await getSupabaseClient().storage.from(process.env.SUPABASE_STORAGE_BUCKET).upload(storageKey, buffer, {
      contentType: mimeType,
      upsert: false,
    });
    if (error) throw error;
    return {
      provider: 'supabase',
      originalName: safeOriginalName,
      storedName: fileName,
      storageKey,
      mimeType,
      size: buffer.length,
    };
  }

  const dir = getConversationStorageDir(conversationId, userId);
  const filePath = path.join(dir, fileName);

  if (filePath.includes('..')) {
    throw createError(400, 'Nom de fichier invalide');
  }

  await fs.promises.writeFile(filePath, buffer, { flag: 'w', mode: 0o600 });

  return {
    provider: 'local',
    originalName: safeOriginalName,
    storedName: fileName,
    storageKey,
    mimeType,
    size: buffer.length,
    absolutePath: filePath,
  };
};

const streamToBuffer = async (body) => {
  if (body && typeof body.transformToByteArray === 'function') {
    return Buffer.from(await body.transformToByteArray());
  }
  const chunks = [];
  for await (const chunk of body) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
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

const readAttachmentObject = async (storageKey) => {
  try {
    const result = await getR2Client().send(new GetObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: ensureSafeStoragePath(storageKey),
    }));
    return {
      content: await streamToBuffer(result.Body),
      contentType: result.ContentType,
    };
  } catch (error) {
    if (error?.name === 'NoSuchKey' || error?.$metadata?.httpStatusCode === 404) {
      throw createError(404, 'Fichier introuvable');
    }
    throw error;
  }
};

const readSupabaseObject = async (storageKey) => {
  const { data, error } = await getSupabaseClient().storage.from(process.env.SUPABASE_STORAGE_BUCKET).download(ensureSafeStoragePath(storageKey));
  if (error) {
    if (error.status === 404 || error.statusCode === 404 || error.statusCode === '404') throw createError(404, 'Fichier introuvable');
    throw error;
  }
  if (!data) throw createError(404, 'Fichier introuvable');
  const content = Buffer.isBuffer(data) ? data : Buffer.from(await data.arrayBuffer());
  return { content, contentType: data.type };
};

const deleteAttachmentObject = async (storageKey) => {
  try {
    await getR2Client().send(new DeleteObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: ensureSafeStoragePath(storageKey),
    }));
  } catch (error) {
    if (error?.name !== 'NoSuchKey' && error?.$metadata?.httpStatusCode !== 404) throw error;
  }
};

const deleteSupabaseObject = async (storageKey) => {
  const { error } = await getSupabaseClient().storage.from(process.env.SUPABASE_STORAGE_BUCKET).remove([ensureSafeStoragePath(storageKey)]);
  if (error && error.status !== 404 && error.statusCode !== 404 && error.statusCode !== '404') throw error;
};

const deleteStoredAttachment = async (attachment) => {
  if (attachment.storageProvider === 'r2') return deleteAttachmentObject(attachment.storageKey);
  if (attachment.storageProvider === 'supabase') return deleteSupabaseObject(attachment.storageKey);
  return deleteAttachmentFile(getLocalAttachmentPath(attachment));
};

const getLocalAttachmentPath = (attachment) => {
  const { storageRoot } = getAttachmentConfig();
  const relativePath = String(attachment.storageKey || attachment.storedName).replace(/\\/g, '/');
  const safeRelative = relativePath.split('/').filter(Boolean).join('/');
  if (!safeRelative || safeRelative.startsWith('..') || safeRelative.includes('../')) {
    throw createError(400, 'Chemin de pièce jointe invalide');
  }
  return path.join(storageRoot, safeRelative);
};

module.exports = {
  getAttachmentConfig,
  validateStorageConfig,
  sanitizeOriginalName,
  buildStorageKey,
  validateMimeType,
  validateFileSize,
  ensureSafeStoragePath,
  writeAttachmentFile,
  readAttachmentFile,
  safeAttachmentUrl,
  deleteAttachmentFile,
  getR2Client,
  getSupabaseClient,
  readAttachmentObject,
  deleteAttachmentObject,
  readSupabaseObject,
  deleteSupabaseObject,
  deleteStoredAttachment,
  getLocalAttachmentPath,
  DEFAULT_ALLOWED_MIME_TYPES,
};
