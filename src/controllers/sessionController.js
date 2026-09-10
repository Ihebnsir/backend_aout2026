const createError = require('http-errors');
const mongoose = require('mongoose');
const sessionService = require('../services/sessionService');
const centreService = require('../services/centreService');

const ensureId = (id) => {
  if (!mongoose.Types.ObjectId.isValid(id)) throw createError(400, 'ID invalide');
};

const getSessions = async (req, res, next) => {
  try {
    const { page, limit } = req.query;
    if (req.user.role === 'centre') {
      const centre = await centreService.findCentreByUserId(req.user.id);
      if (!centre) throw createError(404, 'Aucun centre associé');
      const result = await sessionService.listSessionsForCentre(centre._id, { page, limit });
      return res.status(200).json({ success: true, ...result });
    }

    if (req.user.role === 'apprenant') {
      const result = await sessionService.listSessionsForLearner(req.user.id, { page, limit });
      return res.status(200).json({ success: true, ...result });
    }

    if (req.user.role === 'admin') {
      const result = await sessionService.listSessionsForCentre(req.query.centre || null, { page, limit });
      return res.status(200).json({ success: true, ...result });
    }

    throw createError(403, 'Accès interdit');
  } catch (error) {
    return next(error);
  }
};

const getSessionById = async (req, res, next) => {
  try {
    ensureId(req.params.id);
    const session = await sessionService.getSessionById(req.params.id);

    if (req.user.role === 'centre') {
      const centre = await centreService.findCentreByUserId(req.user.id);
      if (!centre || session.centre.toString() !== centre._id.toString()) throw createError(403, 'Accès interdit');
    }

    if (req.user.role === 'apprenant') {
      const result = await sessionService.listSessionsForLearner(req.user.id);
      const allowed = result.data.some((item) => item._id.toString() === req.params.id);
      if (!allowed) throw createError(403, 'Accès interdit');
    }

    return res.status(200).json({ success: true, data: session });
  } catch (error) {
    return next(error);
  }
};

const createSession = async (req, res, next) => {
  try {
    const centre = await centreService.findCentreByUserId(req.user.id);
    if (!centre) throw createError(404, 'Aucun centre associé');
    const session = await sessionService.createSession(req.body, centre._id);
    return res.status(201).json({ success: true, message: 'Session créée', data: session });
  } catch (error) {
    return next(error);
  }
};

const updateSession = async (req, res, next) => {
  try {
    ensureId(req.params.id);
    const centre = await centreService.findCentreByUserId(req.user.id);
    if (!centre) throw createError(404, 'Aucun centre associé');
    const session = await sessionService.updateSession(req.params.id, req.body, centre._id);
    return res.status(200).json({ success: true, message: 'Session modifiée', data: session });
  } catch (error) {
    return next(error);
  }
};

const deleteSession = async (req, res, next) => {
  try {
    ensureId(req.params.id);
    const centre = await centreService.findCentreByUserId(req.user.id);
    if (!centre) throw createError(404, 'Aucun centre associé');
    const session = await sessionService.deleteSession(req.params.id, centre._id);
    return res.status(200).json({ success: true, message: 'Session supprimée', data: session });
  } catch (error) {
    return next(error);
  }
};

module.exports = { getSessions, getSessionById, createSession, updateSession, deleteSession };
