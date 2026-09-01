const createError = require('http-errors');
const mongoose = require('mongoose');
const centreService = require('../services/centreService');
const centreDocumentService = require('../services/centreDocumentService');

const ensureId = (id) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw createError(400, 'ID invalide');
  }
};

const uploadDocument = async (req, res, next) => {
  try {
    // Récupérer le centre de l'utilisateur
    const userCentre = await centreService.findCentreByUserId(req.user.id);
    if (!userCentre) {
      throw createError(404, 'Aucun centre associé à votre compte');
    }

    const { type, fileUrl } = req.body;

    if (!type || !fileUrl) {
      throw createError(400, 'type et fileUrl sont obligatoires');
    }

    const document = await centreDocumentService.createDocument(userCentre._id, { type, fileUrl });

    return res.status(201).json({
      success: true,
      message: 'Document uploadé avec succès',
      data: document,
    });
  } catch (error) {
    return next(error);
  }
};

const getMyDocuments = async (req, res, next) => {
  try {
    // Récupérer le centre de l'utilisateur
    const userCentre = await centreService.findCentreByUserId(req.user.id);
    if (!userCentre) {
      throw createError(404, 'Aucun centre associé à votre compte');
    }

    const { page, limit, status } = req.query;

    const result = await centreDocumentService.getDocumentsBycentre(userCentre._id, {
      page,
      limit,
      status,
    });

    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    return next(error);
  }
};

const getDocumentById = async (req, res, next) => {
  try {
    ensureId(req.params.id);

    const document = await centreDocumentService.getDocumentById(req.params.id);

    // Vérifier les droits: propriétaire ou admin
    if (req.user.role !== 'admin') {
      const userCentre = await centreService.findCentreByUserId(req.user.id);
      if (!userCentre || document.centre._id.toString() !== userCentre._id.toString()) {
        throw createError(403, 'Accès interdit');
      }
    }

    return res.status(200).json({ success: true, data: document });
  } catch (error) {
    return next(error);
  }
};

const validateDocument = async (req, res, next) => {
  try {
    ensureId(req.params.id);

    const { commentaireAdmin } = req.body;

    const document = await centreDocumentService.validateDocument(req.params.id, {
      commentaireAdmin,
    });

    return res.status(200).json({
      success: true,
      message: 'Document validé avec succès',
      data: document,
    });
  } catch (error) {
    return next(error);
  }
};

const rejectDocument = async (req, res, next) => {
  try {
    ensureId(req.params.id);

    const { commentaireAdmin = '' } = req.body;

    if (!commentaireAdmin) {
      throw createError(400, 'commentaireAdmin est obligatoire');
    }

    const document = await centreDocumentService.rejectDocument(req.params.id, {
      commentaireAdmin,
    });

    return res.status(200).json({
      success: true,
      message: 'Document rejeté avec succès',
      data: document,
    });
  } catch (error) {
    return next(error);
  }
};

const deleteDocument = async (req, res, next) => {
  try {
    ensureId(req.params.id);

    const document = await centreDocumentService.getDocumentById(req.params.id);

    // Vérifier les droits: propriétaire ou admin
    if (req.user.role !== 'admin') {
      const userCentre = await centreService.findCentreByUserId(req.user.id);
      if (!userCentre || document.centre._id.toString() !== userCentre._id.toString()) {
        throw createError(403, 'Accès interdit');
      }
    }

    await centreDocumentService.deleteDocument(req.params.id);

    return res.status(200).json({
      success: true,
      message: 'Document supprimé avec succès',
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  uploadDocument,
  getMyDocuments,
  getDocumentById,
  validateDocument,
  rejectDocument,
  deleteDocument,
};
