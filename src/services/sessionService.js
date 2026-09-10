const mongoose = require('mongoose');
const Session = require('../models/Session');
const Formation = require('../models/Formation');
const Reservation = require('../models/Reservation');
const createError = require('http-errors');

const sanitizeSession = (session) => {
  if (!session) return null;
  const result = session.toObject ? session.toObject() : { ...session };
  delete result.__v;
  return result;
};

const ensureFormationBelongsToCentre = async (formationId, centreId) => {
  const formation = await Formation.findById(formationId).select('_id centre').lean();
  if (!formation) throw createError(404, 'Formation introuvable');
  if (formation.centre.toString() !== centreId.toString()) throw createError(403, 'La formation ne appartient pas à ce centre');
  return formation;
};

const listSessionsForCentre = async (centreId, { page = 1, limit = 20 } = {}) => {
  const p = Math.max(1, Number(page) || 1);
  const l = Math.min(100, Math.max(1, Number(limit) || 20));
  const filter = { centre: centreId };
  const total = await Session.countDocuments(filter);
  const sessions = await Session.find(filter)
    .populate('formation', 'title')
    .sort({ date: 1 })
    .skip((p - 1) * l)
    .limit(l)
    .lean();

  return {
    data: sessions.map(sanitizeSession),
    pagination: { page: p, limit: l, total, pages: Math.max(1, Math.ceil(total / l)) },
  };
};

const listSessionsForLearner = async (learnerId, { page = 1, limit = 20 } = {}) => {
  const p = Math.max(1, Number(page) || 1);
  const l = Math.min(100, Math.max(1, Number(limit) || 20));
  const reservations = await Reservation.find({ learnerId, status: { $in: ['CONFIRMED', 'COMPLETED'] } }).select('formationId').lean();
  const formationIds = reservations.map((r) => r.formationId);

  if (!formationIds.length) {
    return { data: [], pagination: { page: p, limit: l, total: 0, pages: 1 } };
  }

  const total = await Session.countDocuments({ formation: { $in: formationIds } });
  const sessions = await Session.find({ formation: { $in: formationIds } })
    .populate('formation', 'title')
    .sort({ date: 1 })
    .skip((p - 1) * l)
    .limit(l)
    .lean();

  return {
    data: sessions.map(sanitizeSession),
    pagination: { page: p, limit: l, total, pages: Math.max(1, Math.ceil(total / l)) },
  };
};

const getSessionById = async (id) => {
  const session = await Session.findById(id).populate('formation', 'title').lean();
  if (!session) throw createError(404, 'Session introuvable');
  return sanitizeSession(session);
};

const createSession = async (payload, centreId) => {
  await ensureFormationBelongsToCentre(payload.formation, centreId);
  const session = await Session.create({
    ...payload,
    centre: centreId,
    date: new Date(payload.date),
  });
  return sanitizeSession(session);
};

const updateSession = async (id, payload, centreId) => {
  const session = await Session.findById(id).lean();
  if (!session) throw createError(404, 'Session introuvable');
  if (session.centre.toString() !== centreId.toString()) throw createError(403, 'Accès interdit');
  if (payload.formation && payload.formation !== session.formation.toString()) {
    await ensureFormationBelongsToCentre(payload.formation, centreId);
  }
  const updated = await Session.findByIdAndUpdate(
    id,
    {
      ...payload,
      date: payload.date ? new Date(payload.date) : session.date,
    },
    { new: true, runValidators: true }
  ).populate('formation', 'title').lean();
  return sanitizeSession(updated);
};

const deleteSession = async (id, centreId) => {
  const session = await Session.findById(id).lean();
  if (!session) throw createError(404, 'Session introuvable');
  if (session.centre.toString() !== centreId.toString()) throw createError(403, 'Accès interdit');
  const deleted = await Session.findByIdAndDelete(id).lean();
  return sanitizeSession(deleted);
};

module.exports = {
  listSessionsForCentre,
  listSessionsForLearner,
  getSessionById,
  createSession,
  updateSession,
  deleteSession,
};
