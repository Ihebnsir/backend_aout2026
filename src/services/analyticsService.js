const Reservation = require('../models/Reservation');
const Formation = require('../models/Formation');
const User = require('../models/User');
const Centre = require('../models/Centre');
const Attendance = require('../models/Attendance');
const Progress = require('../models/Progress');

const toNumber = (value) => Number(value || 0);

const getCentreOverview = async (centreId) => {
  const [formations, reservations, learners, activeFormations, attendance] = await Promise.all([
    Formation.countDocuments({ centre: centreId }),
    Reservation.countDocuments({ centreId }),
    Reservation.distinct('learnerId', { centreId }).then((ids) => ids.length),
    Formation.countDocuments({ centre: centreId, status: { $in: ['confirmed', 'in-progress'] } }),
    Attendance.countDocuments({ centre: centreId }),
  ]);

  const revenue = await Reservation.aggregate([
    { $match: { centreId, paid: true } },
    { $group: { _id: null, total: { $sum: '$price' } } },
  ]);

  const confirmed = await Reservation.countDocuments({ centreId, status: 'CONFIRMED' });
  const completed = await Reservation.countDocuments({ centreId, status: 'COMPLETED' });
  const cancelled = await Reservation.countDocuments({ centreId, status: 'CANCELLED' });

  return {
    formations,
    activeFormations,
    reservations,
    uniqueLearners: learners,
    confirmed,
    completed,
    cancelled,
    paidReservations: await Reservation.countDocuments({ centreId, paid: true }),
    unpaidReservations: await Reservation.countDocuments({ centreId, paid: false }),
    revenue: toNumber(revenue[0]?.total || 0),
    attendanceRate: attendance ? Math.min(100, Math.max(0, (attendance / Math.max(1, reservations)) * 100)) : 0,
  };
};

const getCentreReservationsAnalytics = async (centreId) => {
  const data = await Reservation.aggregate([
    { $match: { centreId } },
    { $group: { _id: '$status', total: { $sum: 1 } } },
  ]);

  const total = data.reduce((acc, item) => acc + item.total, 0);
  return { total, byStatus: data.map((item) => ({ status: item._id, total: item.total })) };
};

const getCentreRevenueAnalytics = async (centreId) => {
  const byMonth = await Reservation.aggregate([
    { $match: { centreId, paid: true } },
    {
      $group: {
        _id: { month: { $month: '$paymentDate' }, year: { $year: '$paymentDate' } },
        total: { $sum: '$price' },
      },
    },
    { $sort: { '_id.year': 1, '_id.month': 1 } },
  ]);

  return { totalRevenue: await Reservation.aggregate([{ $match: { centreId, paid: true } }, { $group: { _id: null, total: { $sum: '$price' } } }]), byMonth };
};

const getCentreFormationAnalytics = async (centreId) => {
  const items = await Formation.aggregate([
    { $match: { centre: centreId } },
    {
      $lookup: {
        from: 'reservations',
        localField: '_id',
        foreignField: 'formationId',
        as: 'reservations',
      },
    },
    {
      $project: {
        title: 1,
        status: 1,
        reservationCount: { $size: '$reservations' },
        revenue: {
          $sum: '$reservations.price',
        },
      },
    },
  ]);
  return items;
};

const getAdminOverview = async () => {
  const [formations, centres, learners, reservations, revenue] = await Promise.all([
    Formation.countDocuments(),
    Centre.countDocuments(),
    User.countDocuments({ role: 'apprenant' }),
    Reservation.countDocuments(),
    Reservation.aggregate([{ $match: { paid: true } }, { $group: { _id: null, total: { $sum: '$price' } } }]),
  ]);

  return {
    formations,
    centres,
    activeLearners: learners,
    reservations,
    revenue: toNumber(revenue[0]?.total || 0),
    paidReservations: await Reservation.countDocuments({ paid: true }),
    unpaidReservations: await Reservation.countDocuments({ paid: false }),
  };
};

const getAdminGrowth = async () => {
  const data = await Reservation.aggregate([
    {
      $group: {
        _id: { month: { $month: '$createdAt' }, year: { $year: '$createdAt' } },
        reservations: { $sum: 1 },
        revenue: { $sum: { $cond: [{ $eq: ['$paid', true] }, '$price', 0] } },
      },
    },
    { $sort: { '_id.year': 1, '_id.month': 1 } },
  ]);

  return data;
};

const getAdminRevenue = async () => {
  const data = await Reservation.aggregate([
    { $match: { paid: true } },
    { $group: { _id: null, total: { $sum: '$price' } } },
  ]);
  return { totalRevenue: toNumber(data[0]?.total || 0) };
};

const getAdminFormations = async () => {
  return Formation.aggregate([
    { $lookup: { from: 'reservations', localField: '_id', foreignField: 'formationId', as: 'reservations' } },
    { $project: { title: 1, status: 1, reservationCount: { $size: '$reservations' }, revenue: { $sum: '$reservations.price' } } },
    { $sort: { reservationCount: -1 } },
  ]);
};

const getAdminCentres = async () => {
  return Centre.aggregate([
    { $lookup: { from: 'formations', localField: '_id', foreignField: 'centre', as: 'formations' } },
    { $project: { name: 1, formationsCount: { $size: '$formations' }, status: '$statutVerification' } },
  ]);
};

module.exports = {
  getCentreOverview,
  getCentreReservationsAnalytics,
  getCentreRevenueAnalytics,
  getCentreFormationAnalytics,
  getAdminOverview,
  getAdminGrowth,
  getAdminRevenue,
  getAdminFormations,
  getAdminCentres,
};
