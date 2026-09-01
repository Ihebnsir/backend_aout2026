const createError = require('http-errors');
const mongoose = require('mongoose');
const certificationService = require('../services/certificationService');
const reservationService = require('../services/reservationService');

const ensureId = (id) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw createError(400, 'ID invalide');
  }
};

const createCertification = async (req, res, next) => {
  try {
    const { apprenantId, formationId, centreId, dateObtention } = req.body;

    if (!apprenantId || !formationId || !centreId || !dateObtention) {
      throw createError(400, 'apprenantId, formationId, centreId, dateObtention sont obligatoires');
    }

    ensureId(apprenantId);
    ensureId(formationId);
    ensureId(centreId);

    const certification = await certificationService.createCertification(
      apprenantId,
      formationId,
      centreId,
      new Date(dateObtention)
    );

    return res.status(201).json({
      success: true,
      message: 'Certification créée avec succès',
      data: certification,
    });
  } catch (error) {
    return next(error);
  }
};

const getMyCertifications = async (req, res, next) => {
  try {
    const { page, limit, status } = req.query;

    const result = await certificationService.getCertificationsByApprenant(req.user.id, {
      page,
      limit,
      status,
    });

    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    return next(error);
  }
};

const verifyCertification = async (req, res, next) => {
  try {
    const { numeroCertificat } = req.params;

    if (!numeroCertificat) {
      throw createError(400, 'numeroCertificat est obligatoire');
    }

    const certification = await certificationService.verifyCertification(numeroCertificat);

    return res.status(200).json({
      success: true,
      message: 'Certificat vérifié',
      data: certification,
    });
  } catch (error) {
    return next(error);
  }
};

const getCertificationById = async (req, res, next) => {
  try {
    ensureId(req.params.id);

    const certification = await certificationService.getCertificationById(req.params.id);

    // Vérifier les droits: propriétaire ou admin
    if (req.user.role !== 'admin' && certification.apprenant._id.toString() !== req.user.id.toString()) {
      throw createError(403, 'Accès interdit');
    }

    return res.status(200).json({ success: true, data: certification });
  } catch (error) {
    return next(error);
  }
};

const revokeCertification = async (req, res, next) => {
  try {
    ensureId(req.params.id);

    const certification = await certificationService.revokeCertification(req.params.id);

    return res.status(200).json({
      success: true,
      message: 'Certification révoquée avec succès',
      data: certification,
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  createCertification,
  getMyCertifications,
  verifyCertification,
  getCertificationById,
  revokeCertification,
};
