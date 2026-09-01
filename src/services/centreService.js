const Centre = require('../models/Centre');
const CentreHistory = require('../models/CentreHistory');
const notificationService = require('./notificationService');

const sanitizeCentre = (centre) => {
  if (!centre) return null;
  const result = centre.toObject ? centre.toObject() : { ...centre };
  delete result.__v;
  return result;
};

const addHistory = (centreId, action, details, adminId = null) =>
  CentreHistory.create({ centreId, action, details, adminId });

const createCentre = async (payload, userId) => {
  const centre = await Centre.create({ ...payload, userId, statutVerification: 'EN_ATTENTE', dateDemande: new Date() });
  await addHistory(centre._id, 'SOUMISSION', 'Profil centre soumis pour vérification');

  try {
    await notificationService.notifyAdmins(
      'Nouveau centre créé',
      `Le centre "${centre.name}" a soumis une demande de vérification.`,
      'centres'
    );
  } catch (error) {
    // best effort only
  }

  return sanitizeCentre(centre);
};

const findCentreById = async (id) => sanitizeCentre(await Centre.findById(id).lean());
const findCentreByUserId = async (userId) => sanitizeCentre(await Centre.findOne({ userId }).lean());

const listCentres = async ({ page = 1, limit = 10, ville, domaine, statutVerification } = {}) => {
  const normalizedPage = Math.max(1, Number(page));
  const normalizedLimit = Math.min(100, Math.max(1, Number(limit)));
  const filter = {};
  if (ville) filter.ville = new RegExp(ville, 'i');
  if (domaine) filter.domaine = new RegExp(domaine, 'i');
  if (statutVerification) filter.statutVerification = statutVerification;
  const total = await Centre.countDocuments(filter);
  const centres = await Centre.find(filter).sort({ createdAt: -1 }).skip((normalizedPage - 1) * normalizedLimit).limit(normalizedLimit).lean();
  return { data: centres.map(sanitizeCentre), pagination: { page: normalizedPage, limit: normalizedLimit, total, pages: Math.max(1, Math.ceil(total / normalizedLimit)) } };
};

const updateCentre = async (id, payload, actorId) => {
  const centre = await Centre.findByIdAndUpdate(id, payload, { new: true, runValidators: true }).lean();
  if (centre) await addHistory(id, 'MODIFICATION', 'Profil centre modifié', actorId);
  return sanitizeCentre(centre);
};

const deleteCentre = async (id, adminId) => {
  const centre = await Centre.findByIdAndDelete(id).lean();
  if (centre) await addHistory(id, 'SUPPRESSION', 'Profil centre supprimé', adminId);
  return sanitizeCentre(centre);
};

const verifyCentre = async (id, adminId) => {
  const centre = await Centre.findOneAndUpdate(
    { _id: id, statutVerification: { $in: ['EN_ATTENTE', 'DOCUMENTS_RECUS'] } },
    { statutVerification: 'VERIFIE', verifie: true, dateValidation: new Date(), motifRejet: null },
    { new: true, runValidators: true }
  ).lean();
  if (centre) {
    await addHistory(id, 'VERIFICATION', 'Centre vérifié', adminId);

    try {
      await notificationService.createNotification({
        role: 'centre',
        userId: centre.userId,
        title: 'Profil vérifié',
        message: 'Votre profil centre a été vérifié avec succès.',
        category: 'system',
      });
    } catch (error) {
      // best effort only
    }
  }
  return sanitizeCentre(centre);
};

const rejectCentre = async (id, motifRejet, adminId) => {
  const centre = await Centre.findOneAndUpdate(
    { _id: id, statutVerification: { $in: ['EN_ATTENTE', 'DOCUMENTS_RECUS'] } },
    { statutVerification: 'REJETE', verifie: false, motifRejet, dateValidation: null },
    { new: true, runValidators: true }
  ).lean();
  if (centre) {
    await addHistory(id, 'REJET', motifRejet, adminId);

    try {
      await notificationService.createNotification({
        role: 'centre',
        userId: centre.userId,
        title: 'Profil centre rejeté',
        message: `Votre profil centre a été rejeté. Motif : ${motifRejet}`,
        category: 'system',
      });
    } catch (error) {
      // best effort only
    }
  }
  return sanitizeCentre(centre);
};

const suspendCentre = async (id, adminId) => {
  const centre = await Centre.findOneAndUpdate(
    { _id: id, statutVerification: 'VERIFIE' },
    { statutVerification: 'SUSPENDU', verifie: false },
    { new: true, runValidators: true }
  ).lean();
  if (centre) {
    await addHistory(id, 'SUSPENSION', 'Centre suspendu', adminId);

    try {
      await notificationService.createNotification({
        role: 'centre',
        userId: centre.userId,
        title: 'Profil centre suspendu',
        message: 'Votre profil centre a été suspendu par l’administration.',
        category: 'system',
      });
    } catch (error) {
      // best effort only
    }
  }
  return sanitizeCentre(centre);
};

module.exports = { createCentre, findCentreById, findCentreByUserId, listCentres, updateCentre, deleteCentre, verifyCentre, rejectCentre, suspendCentre };