const Certification = require('../models/Certification');
const Reservation = require('../models/Reservation');
const notificationService = require('./notificationService');
const createError = require('http-errors');

const sanitizeCertification = (cert) => {
  if (!cert) return null;
  const certObj = cert.toObject ? cert.toObject() : { ...cert };
  delete certObj.__v;
  return certObj;
};

const isReservationCompleted = async (formationId, apprenantId) => {
  const reservation = await Reservation.findOne({
    formationId,
    learnerId: apprenantId,
    status: 'COMPLETED',
  });

  return !!reservation;
};

const createCertification = async (apprenantId, formationId, centreId, dateObtention) => {
  // Vérifier que la formation est terminée
  const isCompleted = await isReservationCompleted(formationId, apprenantId);
  if (!isCompleted) {
    throw createError(400, 'Réservation non complétée ou introuvable');
  }

  // Vérifier qu'une certification n'existe pas déjà
  const existingCert = await Certification.findOne({
    apprenant: apprenantId,
    formation: formationId,
  });

  if (existingCert) {
    throw createError(409, 'Certification déjà émise pour cette formation');
  }

  const certification = await Certification.create({
    apprenant: apprenantId,
    formation: formationId,
    centre: centreId,
    dateObtention,
  });

  try {
    await notificationService.createNotification({
      role: 'apprenant',
      userId: apprenantId,
      title: 'Nouveau certificat disponible',
      message: `Votre certificat pour la formation a été généré et est désormais disponible.`,
      category: 'certificats',
    });
  } catch (error) {
    // best effort only
  }

  return sanitizeCertification(certification);
};

const getCertificationsByApprenant = async (apprenantId, { page = 1, limit = 10, status } = {}) => {
  const normalizedLimit = Math.max(1, Number(limit));
  const normalizedPage = Math.max(1, Number(page));

  const filter = { apprenant: apprenantId };
  if (status) {
    filter.status = status;
  }

  const total = await Certification.countDocuments(filter);
  const certifications = await Certification.find(filter)
    .populate('formation', 'title')
    .populate('centre', 'name')
    .sort({ dateObtention: -1 })
    .skip((normalizedPage - 1) * normalizedLimit)
    .limit(normalizedLimit)
    .lean();

  return {
    data: certifications.map(sanitizeCertification),
    pagination: {
      page: normalizedPage,
      limit: normalizedLimit,
      total,
      pages: Math.max(1, Math.ceil(total / normalizedLimit)),
    },
  };
};

const verifyCertification = async (numeroCertificat) => {
  const certification = await Certification.findOne({
    numeroCertificat,
    status: 'emise',
  })
    .populate('apprenant', 'nom prenom email')
    .populate('formation', 'title')
    .populate('centre', 'name')
    .lean();

  if (!certification) {
    throw createError(404, 'Certificat introuvable ou révoqué');
  }

  return sanitizeCertification(certification);
};

const getCertificationById = async (certificationId) => {
  const certification = await Certification.findById(certificationId)
    .populate('apprenant', 'nom prenom email')
    .populate('formation', 'title')
    .populate('centre', 'name')
    .lean();

  if (!certification) {
    throw createError(404, 'Certification introuvable');
  }

  return sanitizeCertification(certification);
};

const revokeCertification = async (certificationId) => {
  const certification = await Certification.findByIdAndUpdate(
    certificationId,
    { status: 'revoquee' },
    { new: true, runValidators: true }
  ).lean();

  if (!certification) {
    throw createError(404, 'Certification introuvable');
  }

  return sanitizeCertification(certification);
};

module.exports = {
  createCertification,
  getCertificationsByApprenant,
  verifyCertification,
  getCertificationById,
  revokeCertification,
};
