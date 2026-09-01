const express = require('express');
const router = express.Router();
const reservationController = require('../controllers/reservationController');
const { authenticate } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');
const {
  createReservationRules,
  payReservationRules,
  getReservationsByFormationRules,
  validateRequest,
} = require('../validators/reservationValidator');

// IMPORTANT : /me doit être avant /:id pour éviter que "me" soit interprété comme un ID

// POST /api/reservations - Créer une réservation (apprenant)
router.post('/', authenticate, requireRole('apprenant'), createReservationRules, validateRequest, reservationController.createReservation);

// GET /api/reservations/me - Obtenir mes réservations (apprenant)
router.get('/me', authenticate, requireRole('apprenant'), reservationController.getMyReservations);

// GET /api/reservations - Obtenir toutes les réservations (admin)
router.get('/', authenticate, requireRole('admin'), reservationController.getAllReservations);

// GET /api/reservations/:id - Obtenir une réservation (authentifié)
router.get('/:id', authenticate, reservationController.getReservationById);

// GET /api/reservations/formation/:formationId - Obtenir les réservations d'une formation (centre)
router.get(
  '/formation/:formationId',
  authenticate,
  requireRole('centre', 'admin'),
  getReservationsByFormationRules,
  validateRequest,
  reservationController.getReservationsByFormation
);

// PATCH /api/reservations/:id/cancel - Annuler une réservation (apprenant)
router.patch('/:id/cancel', authenticate, requireRole('apprenant'), reservationController.cancelReservation);

// PATCH /api/reservations/:id/pay - Payer une réservation (apprenant)
router.patch('/:id/pay', authenticate, requireRole('apprenant'), payReservationRules, validateRequest, reservationController.payReservation);

// PATCH /api/reservations/:id/confirm - Confirmer une réservation (centre/admin)
router.patch('/:id/confirm', authenticate, requireRole('centre', 'admin'), reservationController.confirmReservation);

// PATCH /api/reservations/:id/complete - Terminer une réservation (centre/admin)
router.patch('/:id/complete', authenticate, requireRole('centre', 'admin'), reservationController.completeReservation);

module.exports = router;
