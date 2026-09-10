const createError = require('http-errors');
const mongoose = require('mongoose');
const progressService = require('../services/progressService');
const centreService = require('../services/centreService');

const ensureId = (id) => {
  if (!mongoose.Types.ObjectId.isValid(id)) throw createError(400, 'ID invalide');
};

const getMyProgress = async (req, res, next) => {
  try {
    const data = await progressService.listProgressForLearner(req.user.id);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

const getProgressById = async (req, res, next) => {
  try {
    ensureId(req.params.id);
    const progress = await progressService.getProgressById(req.params.id);
    if (req.user.role !== 'admin' && progress.learner.toString() !== req.user.id.toString()) {
      const centre = await centreService.findCentreByUserId(req.user.id);
      if (!centre || progress.centre.toString() !== centre._id.toString()) throw createError(403, 'Accès interdit');
    }
    return res.status(200).json({ success: true, data: progress });
  } catch (error) {
    return next(error);
  }
};

const getProgressByFormation = async (req, res, next) => {
  try {
    ensureId(req.params.formationId);
    const centre = await centreService.findCentreByUserId(req.user.id);
    if (!centre) throw createError(404, 'Aucun centre associé');
    const data = await progressService.getProgressByFormation(req.params.formationId, centre._id);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

const createProgress = async (req, res, next) => {
  try {
    if (req.user.role !== 'apprenant' && req.user.role !== 'centre') {
      throw createError(403, 'Accès interdit');
    }
    if (req.user.role === 'apprenant' && req.body.learner && req.body.learner.toString() !== req.user.id.toString()) {
      throw createError(403, 'Accès interdit');
    }
    const progress = await progressService.createProgress(req.body);
    return res.status(201).json({ success: true, message: 'Progression créée', data: progress });
  } catch (error) {
    return next(error);
  }
};

const updateProgress = async (req, res, next) => {
  try {
    ensureId(req.params.id);
    const centre = await centreService.findCentreByUserId(req.user.id);
    if (!centre) throw createError(404, 'Aucun centre associé');
    const progress = await progressService.updateProgress(req.params.id, req.body, centre._id);
    return res.status(200).json({ success: true, message: 'Progression mise à jour', data: progress });
  } catch (error) {
    return next(error);
  }
};

module.exports = { getMyProgress, getProgressById, getProgressByFormation, createProgress, updateProgress };
