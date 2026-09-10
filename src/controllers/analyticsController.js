const createError = require('http-errors');
const centreService = require('../services/centreService');
const analyticsService = require('../services/analyticsService');

const getCentreOverview = async (req, res, next) => {
  try {
    const centre = await centreService.findCentreByUserId(req.user.id);
    if (!centre) throw createError(404, 'Aucun centre associé');
    const data = await analyticsService.getCentreOverview(centre._id);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

const getCentreReservationsAnalytics = async (req, res, next) => {
  try {
    const centre = await centreService.findCentreByUserId(req.user.id);
    if (!centre) throw createError(404, 'Aucun centre associé');
    const data = await analyticsService.getCentreReservationsAnalytics(centre._id);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

const getCentreRevenueAnalytics = async (req, res, next) => {
  try {
    const centre = await centreService.findCentreByUserId(req.user.id);
    if (!centre) throw createError(404, 'Aucun centre associé');
    const data = await analyticsService.getCentreRevenueAnalytics(centre._id);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

const getCentreFormationAnalytics = async (req, res, next) => {
  try {
    const centre = await centreService.findCentreByUserId(req.user.id);
    if (!centre) throw createError(404, 'Aucun centre associé');
    const data = await analyticsService.getCentreFormationAnalytics(centre._id);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

const getAdminOverview = async (req, res, next) => {
  try {
    const data = await analyticsService.getAdminOverview();
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

const getAdminGrowth = async (req, res, next) => {
  try {
    const data = await analyticsService.getAdminGrowth();
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

const getAdminRevenue = async (req, res, next) => {
  try {
    const data = await analyticsService.getAdminRevenue();
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

const getAdminFormations = async (req, res, next) => {
  try {
    const data = await analyticsService.getAdminFormations();
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

const getAdminCentres = async (req, res, next) => {
  try {
    const data = await analyticsService.getAdminCentres();
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
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
