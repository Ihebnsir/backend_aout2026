const createError = require('http-errors');
const dashboardService = require('../services/dashboardService');

const getOverview = async (req, res, next) => {
  try {
    const data = await dashboardService.getOverview();
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

const getGrowth = async (req, res, next) => {
  try {
    const { period = 'month', months = 6 } = req.query;
    const data = await dashboardService.getGrowth({ period, months: Number(months) });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

const getRevenue = async (req, res, next) => {
  try {
    const { period = 'month', months = 6 } = req.query;
    const data = await dashboardService.getRevenue({ period, months: Number(months) });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

const getRepartition = async (req, res, next) => {
  try {
    const { type } = req.params;
    let data;

    switch (type) {
      case 'reservations':
        data = await dashboardService.getRepartitionReservations();
        break;
      case 'formations':
        data = await dashboardService.getRepartitionFormations();
        break;
      case 'centres':
        data = await dashboardService.getRepartitionCentres();
        break;
      default:
        throw createError(400, 'Type de répartition invalide');
    }

    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

const getTopCentres = async (req, res, next) => {
  try {
    const { limit = 5 } = req.query;
    const data = await dashboardService.getTopCentres({ limit: Number(limit) });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

const getTopFormations = async (req, res, next) => {
  try {
    const { limit = 5 } = req.query;
    const data = await dashboardService.getTopFormations({ limit: Number(limit) });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

const getActiviteRecente = async (req, res, next) => {
  try {
    const { limit = 20 } = req.query;
    const data = await dashboardService.getActiviteRecente({ limit: Number(limit) });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

const getLitigesStats = async (req, res, next) => {
  try {
    const data = await dashboardService.getLitigesStats();
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

const getSignalementsStats = async (req, res, next) => {
  try {
    const data = await dashboardService.getSignalementsStats();
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getOverview,
  getGrowth,
  getRevenue,
  getRepartition,
  getTopCentres,
  getTopFormations,
  getActiviteRecente,
  getLitigesStats,
  getSignalementsStats,
};
