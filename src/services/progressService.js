const createError = require('http-errors');
const Progress = require('../models/Progress');
const Reservation = require('../models/Reservation');

const sanitizeProgress = (progress) => {
  if (!progress) return null;
  const result = progress.toObject ? progress.toObject() : { ...progress };
  delete result.__v;
  return result;
};

const listProgressForLearner = async (learnerId) => {
  const items = await Progress.find({ learner: learnerId })
    .populate('formation', 'title')
    .populate('reservation', 'status')
    .sort({ lastActivityAt: -1 })
    .lean();
  return items.map(sanitizeProgress);
};

const getProgressById = async (id) => {
  const progress = await Progress.findById(id)
    .populate('formation', 'title')
    .populate('reservation', 'status')
    .lean();
  if (!progress) throw createError(404, 'Progression introuvable');
  return sanitizeProgress(progress);
};

const getProgressByFormation = async (formationId, centreId) => {
  const items = await Progress.find({ formation: formationId, centre: centreId })
    .populate('learner', 'nom prenom email')
    .lean();
  return items.map(sanitizeProgress);
};

const createProgress = async (payload) => {
  if (payload.completedSessions > payload.totalSessions) {
    throw createError(400, 'completedSessions ne peut pas dépasser totalSessions');
  }

  const reservation = await Reservation.findById(payload.reservation).lean();
  if (!reservation) throw createError(404, 'Réservation introuvable');
  if (reservation.learnerId.toString() !== payload.learner.toString()) {
    throw createError(403, 'Réservation non compatible avec l’apprenant');
  }

  const existing = await Progress.findOne({ learner: payload.learner, formation: payload.formation }).lean();
  if (existing) throw createError(409, 'Progression déjà existante pour cette formation');

  const item = await Progress.create({
    ...payload,
    status: payload.status || (payload.percentage >= 100 ? 'completed' : payload.percentage > 0 ? 'in-progress' : 'not-started'),
    lastActivityAt: new Date(),
  });

  return sanitizeProgress(item);
};

const updateProgress = async (id, payload, centreId) => {
  const current = await Progress.findById(id).lean();
  if (!current) throw createError(404, 'Progression introuvable');
  if (current.centre.toString() !== centreId.toString()) throw createError(403, 'Accès interdit');
  if (payload.completedSessions > payload.totalSessions) {
    throw createError(400, 'completedSessions ne peut pas dépasser totalSessions');
  }

  const updated = await Progress.findByIdAndUpdate(
    id,
    {
      ...payload,
      lastActivityAt: new Date(),
      status: payload.status || (payload.percentage >= 100 ? 'completed' : payload.percentage > 0 ? 'in-progress' : 'not-started'),
    },
    { new: true, runValidators: true }
  ).lean();

  return sanitizeProgress(updated);
};

module.exports = {
  listProgressForLearner,
  getProgressById,
  getProgressByFormation,
  createProgress,
  updateProgress,
};
