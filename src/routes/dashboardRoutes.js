const express = require('express');

const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const { authenticate } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');
const {
  overviewRules,
  growthRules,
  revenueRules,
  repartitionRules,
  topRules,
  activiteRules,
  validateRequest,
} = require('../validators/dashboardValidator');

// GET /api/admin/dashboard/overview
router.get('/overview', authenticate, requireRole('admin'), overviewRules, validateRequest, dashboardController.getOverview);

// GET /api/admin/dashboard/growth
router.get('/growth', authenticate, requireRole('admin'), growthRules, validateRequest, dashboardController.getGrowth);

// GET /api/admin/dashboard/revenue
router.get('/revenue', authenticate, requireRole('admin'), revenueRules, validateRequest, dashboardController.getRevenue);

// GET /api/admin/dashboard/repartition/:type
router.get('/repartition/:type', authenticate, requireRole('admin'), repartitionRules, validateRequest, dashboardController.getRepartition);

// GET /api/admin/dashboard/top/centres
router.get('/top/centres', authenticate, requireRole('admin'), topRules, validateRequest, dashboardController.getTopCentres);

// GET /api/admin/dashboard/top/formations
router.get('/top/formations', authenticate, requireRole('admin'), topRules, validateRequest, dashboardController.getTopFormations);

// GET /api/admin/dashboard/activite-recente
router.get('/activite-recente', authenticate, requireRole('admin'), activiteRules, validateRequest, dashboardController.getActiviteRecente);

// GET /api/admin/dashboard/litiges-stats
router.get('/litiges-stats', authenticate, requireRole('admin'), dashboardController.getLitigesStats);

// GET /api/admin/dashboard/signalements-stats
router.get('/signalements-stats', authenticate, requireRole('admin'), dashboardController.getSignalementsStats);

module.exports = router;
