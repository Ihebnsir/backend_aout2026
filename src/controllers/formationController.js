const createError = require('http-errors');
const mongoose = require('mongoose');
const centreService = require('../services/centreService');
const formationService = require('../services/formationService');

const ensureId = (id) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw createError(400, 'ID formation invalide');
  }
};

const ensureOwnerOrAdmin = (formation, req) => {
  if (req.user.role === 'admin') return;
  if (!formation || formation.centre._id.toString() !== req.centreId.toString()) {
    throw createError(403, 'Accès interdit');
  }
};

const getAllFormations = async (req, res, next) => {
  try {
    const { page, limit, centre, category, categorie, status, offreStage, search } = req.query;
    const result = await formationService.listFormations({
      page,
      limit,
      centre,
      category,
      categorie,
      status,
      offreStage,
      search,
    });
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    return next(error);
  }
};

const getFormationById = async (req, res, next) => {
  try {
    ensureId(req.params.id);
    const formation = await formationService.findFormationById(req.params.id);
    if (!formation) {
      throw createError(404, 'Formation introuvable');
    }
    return res.status(200).json({ success: true, data: formation });
  } catch (error) {
    return next(error);
  }
};

const createFormation = async (req, res, next) => {
  try {
    // Récupérer le centre de l'utilisateur authentifié
    const userCentre = await centreService.findCentreByUserId(req.user.id);
    if (!userCentre) {
      throw createError(404, 'Aucun centre associé à votre compte');
    }

    // Interdire les champs sensibles
    const forbiddenFields = ['centre', '_id', 'createdAt', 'updatedAt'];
    if (forbiddenFields.some((field) => Object.prototype.hasOwnProperty.call(req.body, field))) {
      throw createError(400, 'Vous ne pouvez pas définir ce champ');
    }

    // Créer la formation associée au centre de l'utilisateur
    const formation = await formationService.createFormation(req.body, userCentre._id);
    return res.status(201).json({
      success: true,
      message: 'Formation créée avec succès',
      data: formation,
    });
  } catch (error) {
    return next(error);
  }
};

const updateFormation = async (req, res, next) => {
  try {
    ensureId(req.params.id);

    // Récupérer la formation
    const formation = await formationService.findFormationById(req.params.id);
    if (!formation) {
      throw createError(404, 'Formation introuvable');
    }

    // Récupérer le centre de l'utilisateur
    const userCentre = await centreService.findCentreByUserId(req.user.id);
    if (!userCentre && req.user.role !== 'admin') {
      throw createError(404, 'Aucun centre associé à votre compte');
    }

    // Vérifier les permissions : owner ou admin
    if (req.user.role !== 'admin') {
      req.centreId = userCentre._id;
      ensureOwnerOrAdmin(formation, req);
    }

    // Interdire la modification du centre
    const forbiddenFields = ['centre', '_id', 'createdAt', 'updatedAt'];
    if (forbiddenFields.some((field) => Object.prototype.hasOwnProperty.call(req.body, field))) {
      throw createError(400, 'Vous ne pouvez pas modifier ce champ');
    }

    // Mettre à jour
    const updatedFormation = await formationService.updateFormation(req.params.id, req.body);
    return res.status(200).json({
      success: true,
      message: 'Formation mise à jour avec succès',
      data: updatedFormation,
    });
  } catch (error) {
    return next(error);
  }
};

const deleteFormation = async (req, res, next) => {
  try {
    ensureId(req.params.id);

    // Récupérer la formation
    const formation = await formationService.findFormationById(req.params.id);
    if (!formation) {
      throw createError(404, 'Formation introuvable');
    }

    // Récupérer le centre de l'utilisateur
    const userCentre = await centreService.findCentreByUserId(req.user.id);
    if (!userCentre && req.user.role !== 'admin') {
      throw createError(404, 'Aucun centre associé à votre compte');
    }

    // Vérifier les permissions : owner ou admin
    if (req.user.role !== 'admin') {
      req.centreId = userCentre._id;
      ensureOwnerOrAdmin(formation, req);
    }

    // Supprimer
    const deletedFormation = await formationService.deleteFormation(req.params.id);
    return res.status(200).json({
      success: true,
      message: 'Formation supprimée avec succès',
      data: deletedFormation,
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getAllFormations,
  getFormationById,
  createFormation,
  updateFormation,
  deleteFormation,
};
