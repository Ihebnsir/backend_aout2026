const CentreDocument = require('../models/CentreDocument');
const Centre = require('../models/Centre');
const notificationService = require('./notificationService');
const createError = require('http-errors');

const sanitizeDocument = (doc) => {
  if (!doc) return null;
  const docObj = doc.toObject ? doc.toObject() : { ...doc };
  delete docObj.__v;
  return docObj;
};

const createDocument = async (centreId, { type, fileUrl }) => {
  const document = await CentreDocument.create({
    centre: centreId,
    type,
    fileUrl,
    status: 'en_attente',
  });

  try {
    const centre = await Centre.findById(centreId).lean();
    if (centre && centre.userId) {
      await notificationService.createNotification({
        role: 'centre',
        userId: centre.userId,
        title: 'Document soumis',
        message: 'Votre document a été soumis et est en attente de validation.',
        category: 'documents',
      });
    }
    await notificationService.notifyAdmins(
      'Nouveau document soumis',
      `Un document a été soumis pour validation par le centre "${centre?.name || 'Centre'}".`,
      'documents'
    );
  } catch (error) {
    // best effort only
  }

  return sanitizeDocument(document);
};

const getDocumentsBycentre = async (centreId, { page = 1, limit = 10, status } = {}) => {
  const normalizedLimit = Math.max(1, Number(limit));
  const normalizedPage = Math.max(1, Number(page));

  const filter = { centre: centreId };
  if (status) {
    filter.status = status;
  }

  const total = await CentreDocument.countDocuments(filter);
  const documents = await CentreDocument.find(filter)
    .sort({ uploadedAt: -1 })
    .skip((normalizedPage - 1) * normalizedLimit)
    .limit(normalizedLimit)
    .lean();

  return {
    data: documents.map(sanitizeDocument),
    pagination: {
      page: normalizedPage,
      limit: normalizedLimit,
      total,
      pages: Math.max(1, Math.ceil(total / normalizedLimit)),
    },
  };
};

const getDocumentById = async (documentId) => {
  const document = await CentreDocument.findById(documentId)
    .populate('centre', 'name email')
    .lean();

  if (!document) {
    throw createError(404, 'Document introuvable');
  }

  return sanitizeDocument(document);
};

const validateDocument = async (documentId, { commentaireAdmin } = {}) => {
  const document = await CentreDocument.findByIdAndUpdate(
    documentId,
    {
      status: 'valide',
      commentaireAdmin: commentaireAdmin || '',
    },
    { new: true, runValidators: true }
  ).lean();

  if (!document) {
    throw createError(404, 'Document introuvable');
  }

  try {
    const centre = await Centre.findById(document.centre).lean();
    if (centre && centre.userId) {
      await notificationService.createNotification({
        role: 'centre',
        userId: centre.userId,
        title: 'Document validé',
        message: 'Votre document a été validé par l’administration.',
        category: 'documents',
      });
    }
  } catch (error) {
    // best effort only
  }

  return sanitizeDocument(document);
};

const rejectDocument = async (documentId, { commentaireAdmin = '' }) => {
  const document = await CentreDocument.findByIdAndUpdate(
    documentId,
    {
      status: 'refuse',
      commentaireAdmin,
    },
    { new: true, runValidators: true }
  ).lean();

  if (!document) {
    throw createError(404, 'Document introuvable');
  }

  try {
    const centre = await Centre.findById(document.centre).lean();
    if (centre && centre.userId) {
      await notificationService.createNotification({
        role: 'centre',
        userId: centre.userId,
        title: 'Document rejeté',
        message: `Votre document a été rejeté. Motif : ${commentaireAdmin || 'Aucun motif fourni'}`,
        category: 'documents',
      });
    }
  } catch (error) {
    // best effort only
  }

  return sanitizeDocument(document);
};

const deleteDocument = async (documentId) => {
  const document = await CentreDocument.findByIdAndDelete(documentId).lean();

  if (!document) {
    throw createError(404, 'Document introuvable');
  }

  return sanitizeDocument(document);
};

module.exports = {
  createDocument,
  getDocumentsBycentre,
  getDocumentById,
  validateDocument,
  rejectDocument,
  deleteDocument,
};
