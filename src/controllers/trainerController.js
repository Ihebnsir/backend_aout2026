const createError = require('http-errors');
const mongoose = require('mongoose');
const trainerService = require('../services/trainerService');
const centreService = require('../services/centreService');

const ensureId = (id) => {
  if (!mongoose.Types.ObjectId.isValid(id)) throw createError(400, 'ID invalide');
};

const getMyTrainers = async (req, res, next) => {
  try {
    const centre = await centreService.findCentreByUserId(req.user.id);
    if (!centre) throw createError(404, 'Aucun centre associé');
    const result = await trainerService.listTrainers(centre._id, req.query);
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    return next(error);
  }
};

const getTrainerById = async (req, res, next) => {
  try {
    ensureId(req.params.id);
    const centre = await centreService.findCentreByUserId(req.user.id);
    if (!centre && req.user.role !== 'admin') throw createError(404, 'Aucun centre associé');
    const trainer = await trainerService.getTrainerById(req.params.id, req.user.role === 'admin' ? null : centre._id);
    return res.status(200).json({ success: true, data: trainer });
  } catch (error) {
    return next(error);
  }
};

const createTrainer = async (req, res, next) => {
  try {
    const centre = await centreService.findCentreByUserId(req.user.id);
    if (!centre) throw createError(404, 'Aucun centre associé');
    const trainer = await trainerService.createTrainer(req.body, centre._id);
    return res.status(201).json({ success: true, message: 'Formateur créé', data: trainer });
  } catch (error) {
    return next(error);
  }
};

const updateTrainer = async (req, res, next) => {
  try {
    ensureId(req.params.id);
    const centre = await centreService.findCentreByUserId(req.user.id);
    if (!centre && req.user.role !== 'admin') throw createError(404, 'Aucun centre associé');
    const trainer = await trainerService.updateTrainer(req.params.id, req.body, req.user.role === 'admin' ? null : centre._id);
    return res.status(200).json({ success: true, message: 'Formateur mis à jour', data: trainer });
  } catch (error) {
    return next(error);
  }
};

const updateTrainerStatus = async (req, res, next) => {
  try {
    ensureId(req.params.id);
    const centre = await centreService.findCentreByUserId(req.user.id);
    if (!centre && req.user.role !== 'admin') throw createError(404, 'Aucun centre associé');
    const trainer = await trainerService.updateTrainerStatus(req.params.id, req.body.status, req.user.role === 'admin' ? null : centre._id);
    return res.status(200).json({ success: true, message: 'Statut du formateur mis à jour', data: trainer });
  } catch (error) {
    return next(error);
  }
};

const deleteTrainer = async (req, res, next) => {
  try {
    ensureId(req.params.id);
    const centre = await centreService.findCentreByUserId(req.user.id);
    if (!centre && req.user.role !== 'admin') throw createError(404, 'Aucun centre associé');
    const result = await trainerService.deleteTrainer(req.params.id, req.user.role === 'admin' ? null : centre._id);
    return res.status(200).json({ success: true, message: 'Formateur supprimé', data: result });
  } catch (error) {
    return next(error);
  }
};

module.exports = { getMyTrainers, getTrainerById, createTrainer, updateTrainer, updateTrainerStatus, deleteTrainer };
