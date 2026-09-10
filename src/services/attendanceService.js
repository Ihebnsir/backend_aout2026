const createError = require('http-errors');
const Attendance = require('../models/Attendance');
const Session = require('../models/Session');
const Reservation = require('../models/Reservation');
const Formation = require('../models/Formation');
const User = require('../models/User');

const sanitizeAttendance = (attendance) => {
  if (!attendance) return null;
  const result = attendance.toObject ? attendance.toObject() : { ...attendance };
  delete result.__v;
  return result;
};

const ensureLearnerIsEnrolled = async (learnerId, formationId, centreId) => {
  const enrolment = await Reservation.findOne({
    learnerId,
    formationId,
    centreId,
    status: { $in: ['CONFIRMED', 'COMPLETED'] },
  }).lean();

  if (!enrolment) {
    throw createError(403, 'L’apprenant n’est pas inscrit à cette formation');
  }
};

const listAttendanceForCentre = async (centreId, { page = 1, limit = 20 } = {}) => {
  const p = Math.max(1, Number(page) || 1);
  const l = Math.min(100, Math.max(1, Number(limit) || 20));
  const filter = { centre: centreId };
  const total = await Attendance.countDocuments(filter);
  const items = await Attendance.find(filter)
    .populate('learner', 'nom prenom email')
    .populate('session', 'title date')
    .sort({ markedAt: -1 })
    .skip((p - 1) * l)
    .limit(l)
    .lean();

  return {
    data: items.map(sanitizeAttendance),
    pagination: { page: p, limit: l, total, pages: Math.max(1, Math.ceil(total / l)) },
  };
};

const listAttendanceForLearner = async (learnerId, { page = 1, limit = 20 } = {}) => {
  const p = Math.max(1, Number(page) || 1);
  const l = Math.min(100, Math.max(1, Number(limit) || 20));
  const filter = { learner: learnerId };
  const total = await Attendance.countDocuments(filter);
  const items = await Attendance.find(filter)
    .populate('session', 'title date')
    .populate('formation', 'title')
    .sort({ markedAt: -1 })
    .skip((p - 1) * l)
    .limit(l)
    .lean();

  return {
    data: items.map(sanitizeAttendance),
    pagination: { page: p, limit: l, total, pages: Math.max(1, Math.ceil(total / l)) },
  };
};

const getAttendanceById = async (id) => {
  const attendance = await Attendance.findById(id)
    .populate('learner', 'nom prenom email')
    .populate('session', 'title date')
    .populate('formation', 'title')
    .lean();
  if (!attendance) throw createError(404, 'Présence introuvable');
  return sanitizeAttendance(attendance);
};

const createAttendance = async (payload, actorId) => {
  const session = await Session.findById(payload.session).lean();
  if (!session) throw createError(404, 'Session introuvable');

  const learner = await User.findById(payload.learner).select('_id role').lean();
  if (!learner || learner.role !== 'apprenant') throw createError(404, 'Apprenant introuvable');

  await ensureLearnerIsEnrolled(payload.learner, payload.formation, payload.centre);

  const existing = await Attendance.findOne({ session: payload.session, learner: payload.learner }).lean();
  if (existing) throw createError(409, 'Une présence existe déjà pour cet apprenant sur cette session');

  const attendance = await Attendance.create({
    ...payload,
    markedBy: actorId,
    markedAt: new Date(),
  });

  return sanitizeAttendance(attendance);
};

const updateAttendance = async (id, payload, centreId) => {
  const existing = await Attendance.findById(id).lean();
  if (!existing) throw createError(404, 'Présence introuvable');
  if (existing.centre.toString() !== centreId.toString()) throw createError(403, 'Accès interdit');

  const updated = await Attendance.findByIdAndUpdate(
    id,
    {
      ...payload,
      markedAt: new Date(),
    },
    { new: true, runValidators: true }
  ).lean();

  return sanitizeAttendance(updated);
};

const listAttendanceForSession = async (sessionId, centreId) => {
  const session = await Session.findById(sessionId).lean();
  if (!session) throw createError(404, 'Session introuvable');
  if (session.centre.toString() !== centreId.toString()) throw createError(403, 'Accès interdit');

  const items = await Attendance.find({ session: sessionId })
    .populate('learner', 'nom prenom email')
    .lean();

  return items.map(sanitizeAttendance);
};

module.exports = {
  listAttendanceForCentre,
  listAttendanceForLearner,
  getAttendanceById,
  createAttendance,
  updateAttendance,
  listAttendanceForSession,
};
