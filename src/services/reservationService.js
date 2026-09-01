const createError = require('http-errors');
const Reservation = require('../models/Reservation');
const Formation = require('../models/Formation');
const User = require('../models/User');
const Centre = require('../models/Centre');
const notificationService = require('./notificationService');

const sanitizeReservation = (reservation) => {
  if (!reservation) return null;
  const result = reservation.toObject ? reservation.toObject() : { ...reservation };
  delete result.__v;
  return result;
};

const generateTransactionId = () => {
  const date = new Date();
  const year = date.getFullYear();
  const randomString = Math.random().toString(36).substring(2, 10).toUpperCase();
  return `TXN-${year}-${randomString}`;
};

const addHistoryEntry = (reservation, action, icon) => {
  if (!reservation.history) {
    reservation.history = [];
  }
  reservation.history.push({
    date: new Date(),
    action,
    icon: icon || null,
  });
};

const validateStatusTransition = (currentStatus, newStatus) => {
  const validTransitions = {
    PENDING: ['CONFIRMED', 'CANCELLED'],
    CONFIRMED: ['COMPLETED', 'CANCELLED'],
    COMPLETED: [],
    CANCELLED: [],
  };

  if (!validTransitions[currentStatus] || !validTransitions[currentStatus].includes(newStatus)) {
    throw createError(400, `Transition invalide : ${currentStatus} → ${newStatus}`);
  }
};

const createReservation = async (learnerId, formationId) => {
  // Vérifier que l'apprenant existe
  const learner = await User.findById(learnerId);
  if (!learner) {
    throw createError(404, 'Apprenant introuvable');
  }

  // Vérifier que la formation existe
  const formation = await Formation.findById(formationId);
  if (!formation) {
    throw createError(404, 'Formation introuvable');
  }

  // Vérifier que le centre existe
  const centre = await Centre.findById(formation.centre);
  if (!centre) {
    throw createError(404, 'Centre associé à la formation introuvable');
  }

  // Vérifier qu'il n'existe pas déjà une réservation active
  const existingReservation = await Reservation.findOne({
    learnerId,
    formationId,
    status: { $in: ['PENDING', 'CONFIRMED'] },
  });

  if (existingReservation) {
    throw createError(409, 'Une réservation active existe déjà pour cette formation');
  }

  // Créer la réservation avec le prix réel de la formation
  const reservation = await Reservation.create({
    learnerId,
    formationId,
    centreId: formation.centre,
    price: formation.price,
    status: 'PENDING',
    paid: false,
    history: [
      {
        date: new Date(),
        action: 'Réservation créée',
        icon: 'create',
      },
    ],
  });

  // Populer et retourner
  await reservation.populate([
    { path: 'learnerId', select: 'nom prenom email' },
    { path: 'formationId', select: 'title image price duration category startDate endDate' },
    { path: 'centreId', select: 'name logo userId' },
  ]);

  try {
    await notificationService.createNotification({
      role: 'apprenant',
      userId: learnerId,
      title: 'Réservation créée',
      message: `Votre réservation pour la formation "${reservation.formationId.title}" a bien été enregistrée.`,
      category: 'reservations',
    });

    if (reservation.centreId && reservation.centreId.userId) {
      await notificationService.createNotification({
        role: 'centre',
        userId: reservation.centreId.userId,
        title: 'Nouvelle réservation',
        message: `Une nouvelle réservation a été créée pour votre formation "${reservation.formationId.title}".`,
        category: 'reservations',
      });
    }

    await notificationService.notifyAdmins(
      'Nouvelle réservation',
      `Une réservation a été créée pour la formation "${reservation.formationId.title}".`,
      'reservations'
    );
  } catch (error) {
    // best effort only
  }

  return sanitizeReservation(reservation);
};

const findReservationById = async (id) => {
  const reservation = await Reservation.findById(id)
    .populate('learnerId', 'nom prenom email')
    .populate('formationId', 'title image price duration category startDate endDate')
    .populate('centreId', 'name logo')
    .lean();
  return sanitizeReservation(reservation);
};

const listReservations = async ({
  page = 1,
  limit = 10,
  status,
  learner,
  centre,
  formation,
} = {}) => {
  const normalizedPage = Math.max(1, Number(page));
  const normalizedLimit = Math.min(100, Math.max(1, Number(limit)));
  const filter = {};

  if (status) {
    filter.status = status;
  }

  if (learner) {
    filter.learnerId = learner;
  }

  if (centre) {
    filter.centreId = centre;
  }

  if (formation) {
    filter.formationId = formation;
  }

  const total = await Reservation.countDocuments(filter);
  const reservations = await Reservation.find(filter)
    .populate('learnerId', 'nom prenom email')
    .populate('formationId', 'title image price duration category startDate endDate')
    .populate('centreId', 'name logo')
    .sort({ createdAt: -1 })
    .skip((normalizedPage - 1) * normalizedLimit)
    .limit(normalizedLimit)
    .lean();

  return {
    data: reservations.map(sanitizeReservation),
    pagination: {
      page: normalizedPage,
      limit: normalizedLimit,
      total,
      pages: Math.max(1, Math.ceil(total / normalizedLimit)),
    },
  };
};

const listMyReservations = async (learnerId, { page = 1, limit = 10 } = {}) => {
  return listReservations({ page, limit, learner: learnerId });
};

const listReservationsByFormation = async (formationId, { page = 1, limit = 10 } = {}) => {
  return listReservations({ page, limit, formation: formationId });
};

const listReservationsByCentre = async (centreId, { page = 1, limit = 10 } = {}) => {
  return listReservations({ page, limit, centre: centreId });
};

const updateReservationStatus = async (id, newStatus) => {
  const reservation = await Reservation.findById(id);
  if (!reservation) {
    throw createError(404, 'Réservation introuvable');
  }

  // Valider la transition
  validateStatusTransition(reservation.status, newStatus);

  // Mettre à jour le statut
  reservation.status = newStatus;

  // Ajouter à l'historique selon le statut
  const statusMessages = {
    CONFIRMED: { action: 'Réservation confirmée', icon: 'confirm' },
    COMPLETED: { action: 'Formation terminée', icon: 'completed' },
    CANCELLED: { action: 'Réservation annulée', icon: 'cancel' },
  };

  if (statusMessages[newStatus]) {
    addHistoryEntry(reservation, statusMessages[newStatus].action, statusMessages[newStatus].icon);
  }

  await reservation.save();

  // Populer et retourner
  await reservation.populate([
    { path: 'learnerId', select: 'nom prenom email' },
    { path: 'formationId', select: 'title image price duration category startDate endDate' },
    { path: 'centreId', select: 'name logo userId' },
  ]);

  try {
    if (newStatus === 'CONFIRMED') {
      await notificationService.createNotification({
        role: 'apprenant',
        userId: reservation.learnerId._id,
        title: 'Inscription confirmée',
        message: `Votre réservation pour la formation "${reservation.formationId.title}" a été confirmée.`,
        category: 'reservations',
      });

      if (reservation.centreId && reservation.centreId.userId) {
        await notificationService.createNotification({
          role: 'centre',
          userId: reservation.centreId.userId,
          title: 'Réservation confirmée',
          message: `La réservation pour la formation "${reservation.formationId.title}" a été confirmée.`,
          category: 'reservations',
        });
      }
    }

    if (newStatus === 'CANCELLED') {
      await notificationService.createNotification({
        role: 'apprenant',
        userId: reservation.learnerId._id,
        title: 'Réservation annulée',
        message: `Votre réservation pour la formation "${reservation.formationId.title}" a été annulée.`,
        category: 'reservations',
      });

      if (reservation.centreId && reservation.centreId.userId) {
        await notificationService.createNotification({
          role: 'centre',
          userId: reservation.centreId.userId,
          title: 'Réservation annulée',
          message: `La réservation pour la formation "${reservation.formationId.title}" a été annulée.`,
          category: 'reservations',
        });
      }
    }
  } catch (error) {
    // best effort only
  }

  return sanitizeReservation(reservation);
};

const cancelReservation = async (id) => {
  return updateReservationStatus(id, 'CANCELLED');
};

const confirmReservation = async (id) => {
  return updateReservationStatus(id, 'CONFIRMED');
};

const completeReservation = async (id) => {
  return updateReservationStatus(id, 'COMPLETED');
};

const payReservation = async (id, paymentMethod) => {
  const reservation = await Reservation.findById(id);
  if (!reservation) {
    throw createError(404, 'Réservation introuvable');
  }

  // Vérifier que la réservation est dans un état payable
  if (reservation.status === 'CANCELLED') {
    throw createError(400, 'Impossible de payer une réservation annulée');
  }

  if (reservation.status === 'COMPLETED') {
    throw createError(400, 'Impossible de payer une réservation terminée');
  }

  // Vérifier qu'elle n'est pas déjà payée
  if (reservation.paid) {
    throw createError(409, 'Cette réservation est déjà payée');
  }

  // Effectuer le paiement
  reservation.paid = true;
  reservation.paymentDate = new Date();
  reservation.paymentMethod = paymentMethod;
  reservation.transactionId = generateTransactionId();

  // Ajouter à l'historique
  addHistoryEntry(reservation, 'Paiement effectué', 'payment');

  await reservation.save();

  // Populer et retourner
  await reservation.populate([
    { path: 'learnerId', select: 'nom prenom email' },
    { path: 'formationId', select: 'title image price duration category startDate endDate' },
    { path: 'centreId', select: 'name logo userId' },
  ]);

  try {
    await notificationService.createNotification({
      role: 'apprenant',
      userId: reservation.learnerId._id,
      title: 'Paiement confirmé',
      message: `Votre paiement pour la formation "${reservation.formationId.title}" a bien été confirmé.`,
      category: 'paiements',
    });

    if (reservation.centreId && reservation.centreId.userId) {
      await notificationService.createNotification({
        role: 'centre',
        userId: reservation.centreId.userId,
        title: 'Paiement reçu',
        message: `Le paiement pour la formation "${reservation.formationId.title}" a été reçu.`,
        category: 'paiements',
      });
    }

    await notificationService.notifyAdmins(
      'Paiement reçu',
      `Un paiement a été reçu pour la formation "${reservation.formationId.title}".`,
      'paiements'
    );
  } catch (error) {
    // best effort only
  }

  return sanitizeReservation(reservation);
};

const deleteReservation = async (id) => {
  const reservation = await Reservation.findByIdAndDelete(id).lean();
  return sanitizeReservation(reservation);
};

module.exports = {
  createReservation,
  findReservationById,
  listReservations,
  listMyReservations,
  listReservationsByFormation,
  listReservationsByCentre,
  updateReservationStatus,
  cancelReservation,
  confirmReservation,
  completeReservation,
  payReservation,
  deleteReservation,
};
