const createError = require('http-errors');
const mongoose = require('mongoose');
const Signalement = require('../models/Signalement');
const User = require('../models/User');

const sanitizeSignalement = (signalement) => {
  if (!signalement) return null;
  const result = signalement.toObject ? signalement.toObject() : { ...signalement };
  delete result.__v;
  result.id = result._id;
  result.date = result.createdAt;
  if (result.reporter && typeof result.reporter === 'object') {
    result.utilisateur = `${result.reporter.prenom || ''} ${result.reporter.nom || ''}`.trim();
  }
  return result;
};

const validateStatusTransition = (currentStatus, newStatus) => {
  const validTransitions = {
    'En attente': ['En cours', 'Résolu'],
    'En cours': ['Résolu'],
    'Résolu': [],
  };

  if (!validTransitions[currentStatus] || !validTransitions[currentStatus].includes(newStatus)) {
    throw createError(400, `Transition invalide : ${currentStatus} → ${newStatus}`);
  }
};

const createSignalement = async (reporterId, { type, contenu, cibleType, cibleId }) => {
  // Vérifier que le reporter existe
  const reporter = await User.findById(reporterId);
  if (!reporter) {
    throw createError(404, 'Reporter introuvable');
  }

  const signalement = await Signalement.create({
    type,
    contenu,
    reporter: reporterId,
    cibleType: cibleType || 'autre',
    cibleId: cibleId || null,
    status: 'En attente',
  });

  await signalement.populate('reporter', 'nom prenom email');

  return sanitizeSignalement(signalement);
};

const listSignalements = async ({ page = 1, limit = 10, type, status, sortOrder = 'desc' } = {}) => {
  const normalizedLimit = Math.max(1, Number(limit));
  const normalizedPage = Math.max(1, Number(page));

  const filter = {};

  if (type) {
    filter.type = type;
  }

  if (status) {
    filter.status = status;
  }

  const total = await Signalement.countDocuments(filter);
  const signalements = await Signalement.find(filter)
    .populate('reporter', 'nom prenom email')
    .populate('traitePar', 'nom prenom email')
    .sort({ createdAt: sortOrder === 'asc' ? 1 : -1 })
    .skip((normalizedPage - 1) * normalizedLimit)
    .limit(normalizedLimit)
    .lean();

  return {
    data: signalements.map(sanitizeSignalement),
    pagination: {
      page: normalizedPage,
      limit: normalizedLimit,
      total,
      pages: Math.max(1, Math.ceil(total / normalizedLimit)),
    },
  };
};

const findSignalementById = async (signalementId) => {
  const signalement = await Signalement.findById(signalementId)
    .populate('reporter', 'nom prenom email')
    .populate('traitePar', 'nom prenom email')
    .lean();

  if (!signalement) {
    throw createError(404, 'Signalement introuvable');
  }

  return sanitizeSignalement(signalement);
};

const updateSignalementStatus = async (signalementId, newStatus, adminId, resolutionNote = '') => {
  const signalement = await Signalement.findById(signalementId);

  if (!signalement) {
    throw createError(404, 'Signalement introuvable');
  }

  // Valider la transition
  validateStatusTransition(signalement.status, newStatus);

  // Mettre à jour
  const updated = await Signalement.findByIdAndUpdate(
    signalementId,
    {
      status: newStatus,
      traitePar: adminId,
      resolutionNote: resolutionNote || null,
    },
    { new: true, runValidators: true }
  ).populate('reporter', 'nom prenom email')
  .populate('traitePar', 'nom prenom email');

  return sanitizeSignalement(updated);
};

const escaladerSignalement = async (signalementId, adminId, overrides = {}) => {
  const signalement = await Signalement.findById(signalementId)
    .populate('reporter')
    .populate('cibleId');

  if (!signalement) {
    throw createError(404, 'Signalement introuvable');
  }

  // Vérifier que le signalement n'est pas déjà escaladé
  if (signalement.litigeId) {
    throw createError(409, 'Ce signalement a déjà été escaladé en litige');
  }

  // Importer ici pour éviter les dépendances circulaires
  const Litige = require('../models/Litige');

  // Mapping type signalement → catégorie litige
  const typeToCategorie = {
    'Contenu inapproprié': 'Qualité formation',
    'Fausse information': 'Qualité formation',
    'Spam': 'Communication',
    Harcelement: 'Communication',
    'Problème technique': 'Réservation',
  };

  const categorie = overrides.categorie || typeToCategorie[signalement.type];
  const priorite = overrides.priorite || 'moyenne';
  const etudiantId = overrides.etudiantId || signalement.reporter._id;
  const Formation = require('../models/Formation');
  const Centre = require('../models/Centre');
  const Reservation = require('../models/Reservation');
  const resolvedFormationId = overrides.formationId
    || (signalement.cibleType === 'formation' ? signalement.cibleId : null);
  const formation = resolvedFormationId ? await Formation.findById(resolvedFormationId).lean() : null;
  const reservation = overrides.reservationId ? await Reservation.findById(overrides.reservationId).lean() : null;
  const centreId = overrides.centreId
    || formation?.centre
    || reservation?.centreId
    || (signalement.cibleType === 'centre' ? signalement.cibleId : null);
  const formationId = resolvedFormationId || null;
  const reservationId = overrides.reservationId || null;

  const missingFields = [];
  if (!categorie) missingFields.push('categorie');
  if (!centreId) {
    missingFields.push('centreId');
  }
  if (formationId && !formation) {
    throw createError(404, 'Formation introuvable');
  }
  if (reservationId && !reservation) {
    throw createError(404, 'Réservation introuvable');
  }
  if (missingFields.length) {
    throw createError(400, `Champs manquants pour l'escalade : ${missingFields.join(', ')}`);
  }

  const student = await User.findById(etudiantId).lean();
  if (!student) {
    throw createError(404, 'Étudiant introuvable');
  }
  const centre = await Centre.findById(centreId).lean();
  if (!centre) {
    throw createError(404, 'Centre introuvable');
  }

  const Counter = require('../models/Counter');
  const year = new Date().getFullYear();
  const sequence = await Counter.findOneAndUpdate(
    { _id: `litige-${year}` },
    { $inc: { value: 1 } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean();
  const numeroDossier = `LTG-${year}-${String(sequence.value).padStart(4, '0')}`;

  // Mapper priorité → SLA
  const prioriteToSla = {
    critique: '12h',
    haute: '24h',
    moyenne: '48h',
    basse: '96h',
  };

  const sla = prioriteToSla[priorite] || '48h';

  // Créer le litige
  let litige;
  try {
    litige = await Litige.create({
      numeroDossier,
      titre: `Litige ${signalement.type}`,
      description: signalement.contenu,
      categorie,
      priorite,
      etudiant: etudiantId,
      centre: centreId,
      formation: formationId,
      reservation: reservationId,
      signalementOrigine: signalementId,
      statut: 'ouvert',
      historique: [
        {
          date: new Date(),
          action: 'Ouverture du litige',
          auteur: 'Système',
          details: 'Dossier créé depuis la modération',
        },
      ],
    });
  } catch (error) {
    if (error.code === 11000 && error.keyPattern?.signalementOrigine) {
      throw createError(409, 'Ce signalement a déjà été escaladé en litige');
    }
    throw error;
  }

  // Mettre à jour le signalement
  await Signalement.findByIdAndUpdate(signalementId, {
    litigeId: litige._id,
    status: 'En cours',
    traitePar: adminId,
  });

  await litige.populate([
    { path: 'etudiant', select: 'nom prenom email' },
    { path: 'centre', select: 'name email' },
    { path: 'formation', select: 'title' },
    { path: 'responsable', select: 'nom prenom email' },
  ]);

  return {
    signalement: sanitizeSignalement(
      await Signalement.findById(signalementId).populate('reporter').populate('traitePar')
    ),
    litige: litige.toObject(),
  };
};

const deleteSignalement = async (signalementId) => {
  const signalement = await Signalement.findByIdAndDelete(signalementId);

  if (!signalement) {
    throw createError(404, 'Signalement introuvable');
  }

  return sanitizeSignalement(signalement);
};

module.exports = {
  createSignalement,
  listSignalements,
  findSignalementById,
  updateSignalementStatus,
  escaladerSignalement,
  deleteSignalement,
};
