const mongoose = require('mongoose');
const Reservation = require('../models/Reservation');
const Progress = require('../models/Progress');
const Attendance = require('../models/Attendance');
const Formation = require('../models/Formation');

const normalize = (value) => (value === undefined || value === null ? '' : String(value));

const getStudentsForCentre = async (centreId, { page = 1, limit = 20, search = '' } = {}) => {
  const p = Math.max(1, Number(page) || 1);
  const l = Math.min(100, Math.max(1, Number(limit) || 20));

  const formationIds = await Formation.find({ centre: centreId }).select('_id').lean();
  const ids = formationIds.map((f) => f._id);

  if (!ids.length) {
    return { data: [], pagination: { page: p, limit: l, total: 0, pages: 1 } };
  }

  const filter = { centreId, formationId: { $in: ids }, status: { $in: ['CONFIRMED', 'COMPLETED'] } };
  if (search) {
    const searchRegex = new RegExp(search, 'i');
    const learnerMatches = await mongoose.model('User').find({ $or: [{ nom: searchRegex }, { prenom: searchRegex }, { email: searchRegex }] }).select('_id').lean();
    const learnerIds = learnerMatches.map((u) => u._id);
    filter.learnerId = { $in: learnerIds };
  }

  const reservations = await Reservation.find(filter)
    .populate('learnerId', 'nom prenom email')
    .populate('formationId', 'title')
    .sort({ createdAt: -1 })
    .skip((p - 1) * l)
    .limit(l)
    .lean();

  const learnerIds = [...new Set(reservations.map((r) => String(r.learnerId._id)))];

  const progressMap = new Map();
  const progressItems = await Progress.find({ learner: { $in: learnerIds }, centre: centreId }).lean();
  progressItems.forEach((item) => progressMap.set(String(item.learner), item));

  const attendanceMap = new Map();
  const attendanceItems = await Attendance.find({ learner: { $in: learnerIds }, centre: centreId }).lean();
  attendanceItems.forEach((item) => {
    const key = String(item.learner);
    const current = attendanceMap.get(key) || { present: 0, absent: 0, late: 0, total: 0 };
    current.total += 1;
    current[item.status] = (current[item.status] || 0) + 1;
    attendanceMap.set(key, current);
  });

  const rows = reservations.map((reservation) => {
    const learner = reservation.learnerId;
    const progress = progressMap.get(String(learner._id));
    const attendance = attendanceMap.get(String(learner._id)) || { present: 0, absent: 0, late: 0, total: 0 };

    return {
      learner: learner ? { _id: learner._id, nom: learner.nom, prenom: learner.prenom, email: learner.email } : null,
      formation: reservation.formationId ? { _id: reservation.formationId._id, title: reservation.formationId.title } : null,
      reservationStatus: reservation.status,
      paid: reservation.paid,
      paymentDate: reservation.paymentDate,
      progress: progress ? {
        _id: progress._id,
        percentage: progress.percentage,
        status: progress.status,
        completedSessions: progress.completedSessions,
        totalSessions: progress.totalSessions,
      } : null,
      attendance: {
        total: attendance.total,
        present: attendance.present,
        absent: attendance.absent,
        late: attendance.late,
      },
    };
  });

  const total = await Reservation.countDocuments(filter);

  return {
    data: rows,
    pagination: { page: p, limit: l, total, pages: Math.max(1, Math.ceil(total / l)) },
  };
};

module.exports = { getStudentsForCentre };
