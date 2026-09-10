const createError = require('http-errors');
const Trainer = require('../models/Trainer');
const Centre = require('../models/Centre');

const sanitizeTrainer = (trainer) => {
  if (!trainer) return null;
  const result = trainer.toObject ? trainer.toObject() : { ...trainer };
  delete result.__v;
  return result;
};

const listTrainers = async (centreId, { page = 1, limit = 20 } = {}) => {
  const p = Math.max(1, Number(page) || 1);
  const l = Math.min(100, Math.max(1, Number(limit) || 20));
  const total = await Trainer.countDocuments({ centre: centreId });
  const trainers = await Trainer.find({ centre: centreId })
    .sort({ createdAt: -1 })
    .skip((p - 1) * l)
    .limit(l)
    .lean();

  return {
    data: trainers.map(sanitizeTrainer),
    pagination: { page: p, limit: l, total, pages: Math.max(1, Math.ceil(total / l)) },
  };
};

const getTrainerById = async (id, centreId = null) => {
  const filter = centreId ? { _id: id, centre: centreId } : { _id: id };
  const trainer = await Trainer.findOne(filter).lean();
  if (!trainer) throw createError(404, 'Formateur introuvable');
  return sanitizeTrainer(trainer);
};

const createTrainer = async (payload, centreId) => {
  const centre = await Centre.findById(centreId).lean();
  if (!centre) throw createError(404, 'Centre introuvable');

  const trainer = await Trainer.create({ ...payload, centre: centreId });
  return sanitizeTrainer(trainer);
};

const updateTrainer = async (id, payload, centreId = null) => {
  const trainer = await getTrainerById(id, centreId);
  const updated = await Trainer.findByIdAndUpdate(id, payload, { new: true, runValidators: true }).lean();
  return sanitizeTrainer(updated);
};

const updateTrainerStatus = async (id, status, centreId = null) => {
  const trainer = await getTrainerById(id, centreId);
  const updated = await Trainer.findByIdAndUpdate(id, { status }, { new: true, runValidators: true }).lean();
  return sanitizeTrainer(updated);
};

const deleteTrainer = async (id, centreId = null) => {
  const trainer = await getTrainerById(id, centreId);
  await Trainer.findByIdAndDelete(id);
  return { success: true };
};

module.exports = {
  listTrainers,
  getTrainerById,
  createTrainer,
  updateTrainer,
  updateTrainerStatus,
  deleteTrainer,
};
