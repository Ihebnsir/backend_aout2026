const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');
const { authenticate } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');

router.get('/centres/me/analytics/overview', authenticate, requireRole('centre'), analyticsController.getCentreOverview);
router.get('/centres/me/analytics/reservations', authenticate, requireRole('centre'), analyticsController.getCentreReservationsAnalytics);
router.get('/centres/me/analytics/revenue', authenticate, requireRole('centre'), analyticsController.getCentreRevenueAnalytics);
router.get('/centres/me/analytics/formations', authenticate, requireRole('centre'), analyticsController.getCentreFormationAnalytics);

router.get('/admin/analytics/overview', authenticate, requireRole('admin'), analyticsController.getAdminOverview);
router.get('/admin/analytics/growth', authenticate, requireRole('admin'), analyticsController.getAdminGrowth);
router.get('/admin/analytics/revenue', authenticate, requireRole('admin'), analyticsController.getAdminRevenue);
router.get('/admin/analytics/formations', authenticate, requireRole('admin'), analyticsController.getAdminFormations);
router.get('/admin/analytics/centres', authenticate, requireRole('admin'), analyticsController.getAdminCentres);

module.exports = router;
