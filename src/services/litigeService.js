const createError = require('http-errors');
const mongoose = require('mongoose');
const Litige = require('../models/Litige');
const User = require('../models/User');

const sanitizeLitige = (litige, includeNotesInternes = false) => {
  if (!litige) return null;
  const result = litige.toObject ? litige.toObject() : { ...litige };
  delete result.__v;

  result.dateOuverture = result.createdAt;
  result.derniereMAJ = result.updatedAt;

  // Filtrer notesInternes si non autorisé
  if (!includeNotesInternes) {
    delete result.notesInternes;
  }

  const slaAndUrgence = calculerSlaEtUrgence(result.priorite);
  result.sla = slaAndUrgence.sla;
  result.niveauUrgence = slaAndUrgence.niveauUrgence;
  result.tempsEcoule = Math.max(0, Date.now() - new Date(result.createdAt).getTime());

  return result;
};

const calculerSlaEtUrgence = (priorite) => {
  const mapping = {
    critique: { sla: '12h', niveauUrgence: 'Urgent' },
    haute: { sla: '24h', niveauUrgence: 'Élevé' },
    moyenne: { sla: '48h', niveauUrgence: 'Normal' },
    basse: { sla: '96h', niveauUrgence: 'Faible' },
  };

  return mapping[priorite] || mapping.moyenne;
};

const validateStatusTransition = (currentStatus, newStatus) => {
  const validTransitions = {
    ouvert: ['analyse'],
    analyse: ['attente_justificatifs'],
    attente_justificatifs: ['en_cours'],
    en_cours: ['decision'],
    decision: ['resolu'],
    resolu: ['archive'],
    archive: [],
  };

  if (!validTransitions[currentStatus] || !validTransitions[currentStatus].includes(newStatus)) {
    throw createError(400, `Transition invalide : ${currentStatus} → ${newStatus}`);
  }
};

const createLitige = async (adminId, { titre, description, categorie, priorite, etudiant, centre, formation, reservation }) => {
  // Vérifier les références
  const etudiantDoc = await User.findById(etudiant);
  if (!etudiantDoc) {
    throw createError(404, 'Étudiant introuvable');
  }

  const Centre = require('../models/Centre');
  const centreDoc = await Centre.findById(centre);
  if (!centreDoc) {
    throw createError(404, 'Centre introuvable');
  }

  if (formation) {
    const Formation = require('../models/Formation');
    const formationDoc = await Formation.findById(formation).lean();
    if (!formationDoc) throw createError(404, 'Formation introuvable');
    if (formationDoc.centre.toString() !== centre.toString()) {
      throw createError(400, 'La formation ne correspond pas au centre');
    }
  }

  if (reservation) {
    const Reservation = require('../models/Reservation');
    const reservationDoc = await Reservation.findById(reservation).lean();
    if (!reservationDoc) throw createError(404, 'Réservation introuvable');
    if (reservationDoc.learnerId.toString() !== etudiant.toString() || reservationDoc.centreId.toString() !== centre.toString()) {
      throw createError(400, 'La réservation ne correspond pas à l’étudiant et au centre');
    }
  }

  // Générer le numéro de dossier
  const litigesCount = await Litige.countDocuments();
  const numeroDossier = `LTG-${new Date().getFullYear()}-${String(litigesCount + 1).padStart(4, '0')}`;

  // Calculer SLA
  let litige;
  try {
    litige = await Litige.create({
      numeroDossier,
      titre,
      description,
      categorie,
      priorite,
      etudiant,
      centre,
      formation: formation || null,
      reservation: reservation || null,
      statut: 'ouvert',
      historique: [
        {
          date: new Date(),
          action: 'Ouverture du litige',
          auteur: 'Système',
          details: 'Dossier créé par l\'administrateur',
        },
      ],
    });
  } catch (error) {
    if (error.code === 11000) {
      throw createError(409, 'Un numéro de dossier ou un signalement associé existe déjà');
    }
    throw error;
  }

  await litige.populate([
    { path: 'etudiant', select: 'nom prenom email' },
    { path: 'centre', select: 'name email' },
    { path: 'formation', select: 'title' },
    { path: 'responsable', select: 'nom prenom email' },
  ]);

  return sanitizeLitige(litige, true);
};

const listLitiges = async ({ page = 1, limit = 10, statut, priorite, categorie } = {}) => {
  const normalizedLimit = Math.max(1, Number(limit));
  const normalizedPage = Math.max(1, Number(page));

  const filter = {};

  if (statut) {
    filter.statut = statut;
  }

  if (priorite) {
    filter.priorite = priorite;
  }

  if (categorie) {
    filter.categorie = categorie;
  }

  const total = await Litige.countDocuments(filter);
  const litiges = await Litige.find(filter)
    .populate([
      { path: 'etudiant', select: 'nom prenom email' },
      { path: 'centre', select: 'name email' },
      { path: 'formation', select: 'title' },
      { path: 'responsable', select: 'nom prenom email' },
    ])
    .sort({ createdAt: -1 })
    .skip((normalizedPage - 1) * normalizedLimit)
    .limit(normalizedLimit)
    .lean();

  return {
    data: litiges.map((litige) => sanitizeLitige(litige, true)),
    pagination: {
      page: normalizedPage,
      limit: normalizedLimit,
      total,
      pages: Math.max(1, Math.ceil(total / normalizedLimit)),
    },
  };
};

const listMesLitiges = async (userId, userRole, { page = 1, limit = 10 } = {}) => {
  const normalizedLimit = Math.max(1, Number(limit));
  const normalizedPage = Math.max(1, Number(page));

  const filter = {};

  if (userRole === 'apprenant') {
    filter.etudiant = userId;
  } else if (userRole === 'centre') {
    filter.centre = userId;
  }

  const total = await Litige.countDocuments(filter);
  const litiges = await Litige.find(filter)
    .populate([
      { path: 'etudiant', select: 'nom prenom email' },
      { path: 'centre', select: 'name email' },
      { path: 'formation', select: 'title' },
      { path: 'responsable', select: 'nom prenom email' },
    ])
    .sort({ createdAt: -1 })
    .skip((normalizedPage - 1) * normalizedLimit)
    .limit(normalizedLimit)
    .lean();

  return {
    data: litiges.map((litige) => sanitizeLitige(litige, false)),
    pagination: {
      page: normalizedPage,
      limit: normalizedLimit,
      total,
      pages: Math.max(1, Math.ceil(total / normalizedLimit)),
    },
  };
};

const findLitigeById = async (litigeId, userRole = 'admin', userId = null) => {
  const litige = await Litige.findById(litigeId).populate([
    { path: 'etudiant', select: 'nom prenom email' },
    { path: 'centre', select: 'name email' },
    { path: 'formation', select: 'title' },
    { path: 'responsable', select: 'nom prenom email' },
  ]);

  if (!litige) {
    throw createError(404, 'Litige introuvable');
  }

  // Vérifier l'accès pour centre/apprenant
  if (userRole === 'apprenant' && litige.etudiant._id.toString() !== userId.toString()) {
    throw createError(403, 'Accès interdit');
  }

  if (userRole === 'centre' && litige.centre._id.toString() !== userId.toString()) {
    throw createError(403, 'Accès interdit');
  }

  return sanitizeLitige(litige, userRole === 'admin');
};

const updateLitigeStatus = async (litigeId, newStatus) => {
  const litige = await Litige.findById(litigeId);

  if (!litige) {
    throw createError(404, 'Litige introuvable');
  }

  // Valider la transition
  validateStatusTransition(litige.statut, newStatus);

  // Ajouter à l'historique
  const historique = litige.historique || [];
  historique.push({
    date: new Date(),
    action: `Changement de statut : ${litige.statut} → ${newStatus}`,
    auteur: 'Système',
    details: `Statut mis à jour vers ${newStatus}`,
  });

  const updated = await Litige.findByIdAndUpdate(
    litigeId,
    {
      statut: newStatus,
      historique,
    },
    { new: true, runValidators: true }
  ).populate([
    { path: 'etudiant', select: 'nom prenom email' },
    { path: 'centre', select: 'name email' },
    { path: 'formation', select: 'title' },
    { path: 'responsable', select: 'nom prenom email' },
  ]);

  return sanitizeLitige(updated, userRole === 'admin');
};

const ajouterMessageConversation = async (litigeId, auteurId, userRole, message, centreId = null) => {
  const litige = await Litige.findById(litigeId);

  if (!litige) {
    throw createError(404, 'Litige introuvable');
  }

  // Vérifier l'ownership
  if (userRole === 'apprenant' && litige.etudiant.toString() !== auteurId.toString()) {
    throw createError(403, 'Accès interdit');
  }

  if (userRole === 'centre' && (!centreId || litige.centre.toString() !== centreId.toString())) {
    throw createError(403, 'Accès interdit');
  }

  if (!litige.conversation) {
    litige.conversation = [];
  }

  litige.conversation.push({
    auteur: auteurId,
    role: userRole,
    message,
    createdAt: new Date(),
  });

  const updated = await litige.save();

  await updated.populate([
    { path: 'etudiant', select: 'nom prenom email' },
    { path: 'centre', select: 'name email' },
    { path: 'formation', select: 'title' },
    { path: 'responsable', select: 'nom prenom email' },
    { path: 'conversation.auteur', select: 'nom prenom email' },
  ]);

  return sanitizeLitige(updated, true);
};

const ajouterPieceJointe = async (litigeId, auteurId, userRole, piece, centreId = null) => {
  const litige = await Litige.findById(litigeId);

  if (!litige) throw createError(404, 'Litige introuvable');
  if (userRole === 'apprenant' && litige.etudiant.toString() !== auteurId.toString()) {
    throw createError(403, 'Accès interdit');
  }
  if (userRole === 'centre' && (!centreId || litige.centre.toString() !== centreId.toString())) {
    throw createError(403, 'Accès interdit');
  }

  litige.piecesJointes.push({
    nom: piece.nom,
    type: piece.type,
    url: piece.url,
    taille: piece.taille,
    uploadedAt: new Date(),
  });

  const updated = await litige.save();
  await updated.populate([
    { path: 'etudiant', select: 'nom prenom email' },
    { path: 'centre', select: 'name email' },
    { path: 'formation', select: 'title' },
    { path: 'responsable', select: 'nom prenom email' },
  ]);

  return sanitizeLitige(updated, userRole === 'admin');
};

const ajouterNoteInterne = async (litigeId, auteurId, contenu) => {
  const litige = await Litige.findById(litigeId);

  if (!litige) {
    throw createError(404, 'Litige introuvable');
  }

  if (!litige.notesInternes) {
    litige.notesInternes = [];
  }

  litige.notesInternes.push({
    auteur: auteurId,
    contenu,
    createdAt: new Date(),
  });

  const updated = await litige.save();

  await updated.populate([
    { path: 'etudiant', select: 'nom prenom email' },
    { path: 'centre', select: 'name email' },
    { path: 'formation', select: 'title' },
    { path: 'responsable', select: 'nom prenom email' },
    { path: 'notesInternes.auteur', select: 'nom prenom email' },
  ]);

  return sanitizeLitige(updated, true);
};

const assignerResponsable = async (litigeId, responsableId) => {
  const litige = await Litige.findById(litigeId);

  if (!litige) {
    throw createError(404, 'Litige introuvable');
  }

  const responsable = await User.findById(responsableId);
  if (!responsable) {
    throw createError(404, 'Responsable introuvable');
  }

  // Ajouter à l'historique
  const historique = litige.historique || [];
  historique.push({
    date: new Date(),
    action: 'Assignation d\'un responsable',
    auteur: 'Système',
    details: `Responsable assigné : ${responsable.nom} ${responsable.prenom}`,
  });

  const updated = await Litige.findByIdAndUpdate(
    litigeId,
    {
      responsable: responsableId,
      historique,
    },
    { new: true, runValidators: true }
  ).populate([
    { path: 'etudiant', select: 'nom prenom email' },
    { path: 'centre', select: 'name email' },
    { path: 'formation', select: 'title' },
    { path: 'responsable', select: 'nom prenom email' },
  ]);

  return sanitizeLitige(updated, true);
};

const cloturerLitige = async (litigeId, decisionFinale) => {
  if (!decisionFinale || decisionFinale.trim() === '') {
    throw createError(400, 'decisionFinale est obligatoire pour clôturer');
  }

  const litige = await Litige.findById(litigeId);

  if (!litige) {
    throw createError(404, 'Litige introuvable');
  }

  // Vérifier que le statut est compatible
  if (litige.statut !== 'decision') {
    throw createError(400, `Impossible de clôturer depuis le statut '${litige.statut}'`);
  }

  const historique = litige.historique || [];
  historique.push({
    date: new Date(),
    action: 'Clôture du dossier',
    auteur: 'Système',
    details: 'Litige marqué comme résolu',
  });

  const updated = await Litige.findByIdAndUpdate(
    litigeId,
    {
      statut: 'resolu',
      decisionFinale,
      historique,
    },
    { new: true, runValidators: true }
  ).populate([
    { path: 'etudiant', select: 'nom prenom email' },
    { path: 'centre', select: 'name email' },
    { path: 'formation', select: 'title' },
    { path: 'responsable', select: 'nom prenom email' },
  ]);

  return sanitizeLitige(updated, true);
};

const archiverLitige = async (litigeId) => {
  const litige = await Litige.findById(litigeId);

  if (!litige) {
    throw createError(404, 'Litige introuvable');
  }

  if (litige.statut !== 'resolu') {
    throw createError(400, 'Seuls les litiges résolus peuvent être archivés');
  }

  const historique = litige.historique || [];
  historique.push({
    date: new Date(),
    action: 'Archivage du dossier',
    auteur: 'Système',
    details: 'Litige archivé',
  });

  const updated = await Litige.findByIdAndUpdate(
    litigeId,
    {
      statut: 'archive',
      historique,
    },
    { new: true, runValidators: true }
  ).populate([
    { path: 'etudiant', select: 'nom prenom email' },
    { path: 'centre', select: 'name email' },
    { path: 'formation', select: 'title' },
    { path: 'responsable', select: 'nom prenom email' },
  ]);

  return sanitizeLitige(updated, true);
};

const getStatsEtudiant = async (etudiantId) => {
  const litiges = await Litige.find({ etudiant: etudiantId });

  const litigesAnterieurs = litiges.length;
  const dossiersResolus = litiges.filter((l) => l.statut === 'resolu').length;

  return {
    litigesAnterieurs,
    dossiersResolus,
  };
};

const getStatsCentre = async (centreId) => {
  const litiges = await Litige.find({ centre: centreId });

  const litigesTotal = litiges.length;
  const litigesResolus = litiges.filter((l) => l.statut === 'resolu').length;

  // Calculer le temps moyen (en jours)
  let tempsMoyen = 0;
  if (litigesResolus > 0) {
    const totalDays = litiges.reduce((sum, litige) => {
      if (litige.statut === 'resolu') {
        const start = new Date(litige.createdAt);
        const end = new Date(litige.updatedAt);
        const days = (end - start) / (1000 * 60 * 60 * 24);
        return sum + days;
      }
      return sum;
    }, 0);

    tempsMoyen = (totalDays / litigesResolus).toFixed(1);
  }

  return {
    litigesTotal,
    litigesResolus,
    tempsMoyen,
  };
};

module.exports = {
  createLitige,
  listLitiges,
  listMesLitiges,
  findLitigeById,
  updateLitigeStatus,
  ajouterMessageConversation,
  ajouterPieceJointe,
  ajouterNoteInterne,
  assignerResponsable,
  cloturerLitige,
  archiverLitige,
  getStatsEtudiant,
  getStatsCentre,
};
