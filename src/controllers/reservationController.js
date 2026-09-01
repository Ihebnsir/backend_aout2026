const createError = require('http-errors');
const mongoose = require('mongoose');
const centreService = require('../services/centreService');
const reservationService = require('../services/reservationService');

const ensureId = (id) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw createError(400, 'ID réservation invalide');
  }
};

const ensureReservationOwner = (reservation, req) => {
  if (req.user.role === 'admin') return;
  if (!reservation || reservation.learnerId.toString() !== req.user.id.toString()) {
    throw createError(403, 'Accès interdit');
  }
};

const ensureFormationCentreOwner = (reservation, req) => {
  if (req.user.role === 'admin') return;
  if (!reservation || reservation.centreId.toString() !== req.centreId.toString()) {
    throw createError(403, 'Accès interdit');
  }
};

// POST /api/reservations - Créer une réservation (apprenant)
const createReservation = async (req, res, next) => {
  try {
    const { formationId } = req.body;

    if (!formationId) {
      throw createError(400, 'formationId est obligatoire');
    }

    ensureId(formationId);

    // Créer la réservation
    const reservation = await reservationService.createReservation(req.user.id, formationId);

    return res.status(201).json({
      success: true,
      message: 'Réservation créée avec succès',
      data: reservation,
    });
  } catch (error) {
    return next(error);
  }
};

// GET /api/reservations/me - Obtenir mes réservations (apprenant)
const getMyReservations = async (req, res, next) => {
  try {
    const { page, limit } = req.query;
    const result = await reservationService.listMyReservations(req.user.id, { page, limit });
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    return next(error);
  }
};

// GET /api/reservations - Obtenir toutes les réservations (admin)
const getAllReservations = async (req, res, next) => {
  try {
    const { page, limit, status, learner, centre, formation } = req.query;
    const result = await reservationService.listReservations({
      page,
      limit,
      status,
      learner,
      centre,
      formation,
    });
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    return next(error);
  }
};

// GET /api/reservations/:id - Obtenir une réservation par ID
const getReservationById = async (req, res, next) => {
  try {
    ensureId(req.params.id);
    const reservation = await reservationService.findReservationById(req.params.id);

    if (!reservation) {
      throw createError(404, 'Réservation introuvable');
    }

    // Vérifier les permissions : propriétaire de la réservation ou admin
    if (req.user.role !== 'admin' && reservation.learnerId._id.toString() !== req.user.id.toString()) {
      throw createError(403, 'Accès interdit');
    }

    return res.status(200).json({ success: true, data: reservation });
  } catch (error) {
    return next(error);
  }
};

// GET /api/reservations/formation/:formationId - Obtenir les réservations d'une formation (centre)
const getReservationsByFormation = async (req, res, next) => {
  try {
    const { formationId } = req.params;
    const { page, limit } = req.query;

    ensureId(formationId);

    // Récupérer le centre de l'utilisateur
    const userCentre = await centreService.findCentreByUserId(req.user.id);
    if (!userCentre && req.user.role !== 'admin') {
      throw createError(404, 'Aucun centre associé à votre compte');
    }

    // Vérifier que la formation appartient au centre
    if (req.user.role !== 'admin') {
      const Formation = require('../models/Formation');
      const formation = await Formation.findById(formationId);
      if (!formation || formation.centre.toString() !== userCentre._id.toString()) {
        throw createError(403, 'Accès interdit');
      }
    }

    const result = await reservationService.listReservationsByFormation(formationId, { page, limit });
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    return next(error);
  }
};

// PATCH /api/reservations/:id/cancel - Annuler une réservation (apprenant)
const cancelReservation = async (req, res, next) => {
  try {
    ensureId(req.params.id);

    const reservation = await reservationService.findReservationById(req.params.id);
    if (!reservation) {
      throw createError(404, 'Réservation introuvable');
    }

    // Vérifier que c'est le propriétaire
    ensureReservationOwner(reservation, req);

    // Annuler
    const updated = await reservationService.cancelReservation(req.params.id);
    return res.status(200).json({
      success: true,
      message: 'Réservation annulée avec succès',
      data: updated,
    });
  } catch (error) {
    return next(error);
  }
};

// PATCH /api/reservations/:id/pay - Payer une réservation (apprenant)
const payReservation = async (req, res, next) => {
  try {
    ensureId(req.params.id);

    const { paymentMethod } = req.body;

    if (!paymentMethod) {
      throw createError(400, 'paymentMethod est obligatoire');
    }

    const reservation = await reservationService.findReservationById(req.params.id);
    if (!reservation) {
      throw createError(404, 'Réservation introuvable');
    }

    // Vérifier que c'est le propriétaire
    ensureReservationOwner(reservation, req);

    // Payer
    const updated = await reservationService.payReservation(req.params.id, paymentMethod);
    return res.status(200).json({
      success: true,
      message: 'Paiement effectué avec succès',
      data: updated,
    });
  } catch (error) {
    return next(error);
  }
};

// PATCH /api/reservations/:id/confirm - Confirmer une réservation (centre/admin)
const confirmReservation = async (req, res, next) => {
  try {
    ensureId(req.params.id);

    const reservation = await reservationService.findReservationById(req.params.id);
    if (!reservation) {
      throw createError(404, 'Réservation introuvable');
    }

    // Vérifier les permissions : centre propriétaire ou admin
    if (req.user.role !== 'admin') {
      const userCentre = await centreService.findCentreByUserId(req.user.id);
      if (!userCentre) {
        throw createError(404, 'Aucun centre associé à votre compte');
      }
      req.centreId = userCentre._id;
      ensureFormationCentreOwner(reservation, req);
    }

    // Confirmer
    const updated = await reservationService.confirmReservation(req.params.id);
    return res.status(200).json({
      success: true,
      message: 'Réservation confirmée avec succès',
      data: updated,
    });
  } catch (error) {
    return next(error);
  }
};

// PATCH /api/reservations/:id/complete - Terminer une réservation (centre/admin)
const completeReservation = async (req, res, next) => {
  try {
    ensureId(req.params.id);

    const reservation = await reservationService.findReservationById(req.params.id);
    if (!reservation) {
      throw createError(404, 'Réservation introuvable');
    }

    // Vérifier les permissions : centre propriétaire ou admin
    if (req.user.role !== 'admin') {
      const userCentre = await centreService.findCentreByUserId(req.user.id);
      if (!userCentre) {
        throw createError(404, 'Aucun centre associé à votre compte');
      }
      req.centreId = userCentre._id;
      ensureFormationCentreOwner(reservation, req);
    }

    // Terminer
    const updated = await reservationService.completeReservation(req.params.id);
    return res.status(200).json({
      success: true,
      message: 'Réservation terminée avec succès',
      data: updated,
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  createReservation,
  getMyReservations,
  getAllReservations,
  getReservationById,
  getReservationsByFormation,
  cancelReservation,
  payReservation,
  confirmReservation,
  completeReservation,
};
