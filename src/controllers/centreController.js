const createError = require('http-errors');
const mongoose = require('mongoose');
const User = require('../models/User');
const centreService = require('../services/centreService');

const ensureId = (id) => {
  if (!mongoose.Types.ObjectId.isValid(id)) throw createError(400, 'ID centre invalide');
};

const ensureOwnerOrAdmin = (centre, req) => {
  if (req.user.role === 'admin') return;
  if (!centre || centre.userId.toString() !== req.user.id.toString()) throw createError(403, 'Accès interdit');
};

const getAllCentres = async (req, res, next) => {
  try {
    const { page, limit, ville, domaine, statutVerification } = req.query;
    const result = await centreService.listCentres({ page, limit, ville, domaine, statutVerification });
    return res.status(200).json({ success: true, ...result });
  } catch (error) { return next(error); }
};

const getCentreById = async (req, res, next) => {
  try {
    ensureId(req.params.id);
    const centre = await centreService.findCentreById(req.params.id);
    if (!centre) throw createError(404, 'Centre introuvable');
    return res.status(200).json({ success: true, data: centre });
  } catch (error) { return next(error); }
};

const getMyCentre = async (req, res, next) => {
  try {
    const centre = await centreService.findCentreByUserId(req.user.id);
    if (!centre) throw createError(404, 'Centre introuvable');
    return res.status(200).json({ success: true, data: centre });
  } catch (error) { return next(error); }
};

const createCentre = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select('role');
    if (!user || user.role !== 'centre') throw createError(403, 'Seul un compte centre peut créer un profil centre');
    const existingCentre = await centreService.findCentreByUserId(req.user.id);
    if (existingCentre) throw createError(409, 'Un profil centre existe déjà pour ce compte');
    const { userId, statutVerification, verifie, dateDemande, dateValidation, motifRejet, ...payload } = req.body;
    const centre = await centreService.createCentre(payload, req.user.id);
    return res.status(201).json({ success: true, message: 'Centre créé avec succès', data: centre });
  } catch (error) {
    if (error.code === 11000) return next(createError(409, 'Un profil centre existe déjà pour ce compte'));
    return next(error);
  }
};

const updateCentre = async (req, res, next) => {
  try {
    ensureId(req.params.id);
    const centre = await centreService.findCentreById(req.params.id);
    if (!centre) throw createError(404, 'Centre introuvable');
    ensureOwnerOrAdmin(centre, req);
    const forbiddenFields = ['userId', 'statutVerification', 'verifie', 'dateDemande', 'dateValidation', 'motifRejet'];
    if (forbiddenFields.some((field) => Object.prototype.hasOwnProperty.call(req.body, field))) {
      throw createError(403, 'Vous ne pouvez pas modifier le statut ou le propriétaire du centre');
    }
    const updatedCentre = await centreService.updateCentre(req.params.id, req.body, req.user.id);
    return res.status(200).json({ success: true, message: 'Centre mis à jour avec succès', data: updatedCentre });
  } catch (error) { return next(error); }
};

const deleteCentre = async (req, res, next) => {
  try {
    ensureId(req.params.id);
    const centre = await centreService.deleteCentre(req.params.id, req.user.id);
    if (!centre) throw createError(404, 'Centre introuvable');
    return res.status(200).json({ success: true, message: 'Centre supprimé avec succès', data: centre });
  } catch (error) { return next(error); }
};

const verifyCentre = async (req, res, next) => {
  try {
    ensureId(req.params.id);
    const centre = await centreService.verifyCentre(req.params.id, req.user.id);
    if (!centre) throw createError(400, 'Transition de vérification invalide');
    return res.status(200).json({ success: true, message: 'Centre vérifié avec succès', data: centre });
  } catch (error) { return next(error); }
};

const rejectCentre = async (req, res, next) => {
  try {
    ensureId(req.params.id);
    const motif = typeof req.body.motifRejet === 'string' ? req.body.motifRejet.trim() : '';
    if (!motif) throw createError(400, 'Le motif de rejet est obligatoire');
    const centre = await centreService.rejectCentre(req.params.id, motif, req.user.id);
    if (!centre) throw createError(400, 'Transition de vérification invalide');
    return res.status(200).json({ success: true, message: 'Centre rejeté', data: centre });
  } catch (error) { return next(error); }
};

const suspendCentre = async (req, res, next) => {
  try {
    ensureId(req.params.id);
    const centre = await centreService.suspendCentre(req.params.id, req.user.id);
    if (!centre) throw createError(400, 'Seul un centre vérifié peut être suspendu');
    return res.status(200).json({ success: true, message: 'Centre suspendu', data: centre });
  } catch (error) { return next(error); }
};

module.exports = { getAllCentres, getCentreById, getMyCentre, createCentre, updateCentre, deleteCentre, verifyCentre, rejectCentre, suspendCentre };