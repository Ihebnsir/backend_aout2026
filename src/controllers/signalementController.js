const createError = require('http-errors');
const mongoose = require('mongoose');
const signalementService = require('../services/signalementService');

const ensureId = (id) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw createError(400, 'ID signalement invalide');
  }
};

// POST /api/signalements - Créer un signalement
const createSignalement = async (req, res, next) => {
  try {
    const { type, contenu, cibleType, cibleId } = req.body;

    if (!type || !contenu) {
      throw createError(400, 'type et contenu sont obligatoires');
    }

    const signalement = await signalementService.createSignalement(req.user.id, {
      type,
      contenu,
      cibleType,
      cibleId,
    });

    return res.status(201).json({
      success: true,
      message: 'Signalement créé avec succès',
      data: signalement,
    });
  } catch (error) {
    return next(error);
  }
};

// GET /api/signalements - Lister les signalements (admin)
const listSignalements = async (req, res, next) => {
  try {
    const { page, limit, type, status } = req.query;

    const result = await signalementService.listSignalements({
      page,
      limit,
      type,
      status,
    });

    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    return next(error);
  }
};

// GET /api/signalements/:id - Consulter un signalement (admin)
const getSignalementById = async (req, res, next) => {
  try {
    ensureId(req.params.id);

    const signalement = await signalementService.findSignalementById(req.params.id);

    return res.status(200).json({ success: true, data: signalement });
  } catch (error) {
    return next(error);
  }
};

// PATCH /api/signalements/:id/status - Changer le statut (admin)
const updateSignalementStatus = async (req, res, next) => {
  try {
    ensureId(req.params.id);

    const { status, resolutionNote } = req.body;

    if (!status) {
      throw createError(400, 'status est obligatoire');
    }

    const signalement = await signalementService.updateSignalementStatus(
      req.params.id,
      status,
      req.user.id,
      resolutionNote
    );

    return res.status(200).json({
      success: true,
      message: 'Statut mis à jour',
      data: signalement,
    });
  } catch (error) {
    return next(error);
  }
};

// PATCH /api/signalements/:id/escalate - Escalader en litige (admin)
const escaladerSignalement = async (req, res, next) => {
  try {
    ensureId(req.params.id);

    const { categorie, priorite, centreId, formationId, etudiantId, reservationId } = req.body;

    const result = await signalementService.escaladerSignalement(
      req.params.id,
      req.user.id,
      { categorie, priorite, centreId, formationId, etudiantId, reservationId }
    );

    return res.status(201).json({
      success: true,
      message: 'Signalement escaladé en litige',
      data: result,
    });
  } catch (error) {
    return next(error);
  }
};

// DELETE /api/signalements/:id - Supprimer un signalement (admin)
const deleteSignalement = async (req, res, next) => {
  try {
    ensureId(req.params.id);

    await signalementService.deleteSignalement(req.params.id);

    return res.status(200).json({
      success: true,
      message: 'Signalement supprimé',
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  createSignalement,
  listSignalements,
  getSignalementById,
  updateSignalementStatus,
  escaladerSignalement,
  deleteSignalement,
};
