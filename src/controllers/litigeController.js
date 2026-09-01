const createError = require('http-errors');
const mongoose = require('mongoose');
const centreService = require('../services/centreService');
const litigeService = require('../services/litigeService');

const ensureId = (id) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw createError(400, 'ID litige invalide');
  }
};

// POST /api/litiges - Créer un litige (admin)
const createLitige = async (req, res, next) => {
  try {
    const { titre, description, categorie, priorite, etudiant, centre, formation, reservation } = req.body;

    if (!titre || !description || !categorie || !etudiant || !centre) {
      throw createError(400, 'titre, description, categorie, etudiant, centre sont obligatoires');
    }

    ensureId(etudiant);
    ensureId(centre);
    if (formation) ensureId(formation);
    if (reservation) ensureId(reservation);

    const litige = await litigeService.createLitige(req.user.id, {
      titre,
      description,
      categorie,
      priorite,
      etudiant,
      centre,
      formation,
      reservation,
    });

    return res.status(201).json({
      success: true,
      message: 'Litige créé avec succès',
      data: litige,
    });
  } catch (error) {
    return next(error);
  }
};

// GET /api/litiges - Lister les litiges (admin)
const listLitiges = async (req, res, next) => {
  try {
    const { page, limit, statut, priorite, categorie } = req.query;

    const result = await litigeService.listLitiges({
      page,
      limit,
      statut,
      priorite,
      categorie,
    });

    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    return next(error);
  }
};

// GET /api/litiges/me - Lister mes litiges (apprenant/centre)
const getMesLitiges = async (req, res, next) => {
  try {
    const { page, limit } = req.query;

    let centreId = req.user.id;
    if (req.user.role === 'centre') {
      // Pour un centre, on doit passer son centre document ID
      const userCentre = await centreService.findCentreByUserId(req.user.id);
      if (userCentre) {
        centreId = userCentre._id;
      }
    }

    const result = await litigeService.listMesLitiges(centreId, req.user.role, {
      page,
      limit,
    });

    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    return next(error);
  }
};

// GET /api/litiges/:id - Consulter un litige
const getLitigeById = async (req, res, next) => {
  try {
    ensureId(req.params.id);

    let centreId = req.user.id;
    if (req.user.role === 'centre') {
      const userCentre = await centreService.findCentreByUserId(req.user.id);
      if (userCentre) {
        centreId = userCentre._id;
      }
    }

    const litige = await litigeService.findLitigeById(req.params.id, req.user.role, centreId);

    return res.status(200).json({ success: true, data: litige });
  } catch (error) {
    return next(error);
  }
};

// PATCH /api/litiges/:id/status - Changer le statut (admin)
const updateLitigeStatus = async (req, res, next) => {
  try {
    ensureId(req.params.id);

    const { statut } = req.body;

    if (!statut) {
      throw createError(400, 'statut est obligatoire');
    }

    const litige = await litigeService.updateLitigeStatus(req.params.id, statut);

    return res.status(200).json({
      success: true,
      message: 'Statut mis à jour',
      data: litige,
    });
  } catch (error) {
    return next(error);
  }
};

// PATCH /api/litiges/:id/assign - Assigner un responsable (admin)
const assignerResponsable = async (req, res, next) => {
  try {
    ensureId(req.params.id);

    const { responsableId } = req.body;

    if (!responsableId) {
      throw createError(400, 'responsableId est obligatoire');
    }

    ensureId(responsableId);

    const litige = await litigeService.assignerResponsable(req.params.id, responsableId);

    return res.status(200).json({
      success: true,
      message: 'Responsable assigné',
      data: litige,
    });
  } catch (error) {
    return next(error);
  }
};

// POST /api/litiges/:id/messages - Ajouter un message (apprenant/centre/admin)
const ajouterMessage = async (req, res, next) => {
  try {
    ensureId(req.params.id);

    const { message } = req.body;

    if (!message) {
      throw createError(400, 'message est obligatoire');
    }

    let centreId = null;
    if (req.user.role === 'centre') {
      const userCentre = await centreService.findCentreByUserId(req.user.id);
      if (userCentre) {
        centreId = userCentre._id;
      }
    }

    const litige = await litigeService.ajouterMessageConversation(
      req.params.id,
      req.user.id,
      req.user.role,
      message,
      centreId
    );

    return res.status(201).json({
      success: true,
      message: 'Message ajouté',
      data: litige,
    });
  } catch (error) {
    return next(error);
  }
};

// POST /api/litiges/:id/pieces-jointes - Ajouter les métadonnées d'une pièce jointe
const ajouterPieceJointe = async (req, res, next) => {
  try {
    ensureId(req.params.id);

    let centreId = null;
    if (req.user.role === 'centre') {
      const userCentre = await centreService.findCentreByUserId(req.user.id);
      if (userCentre) centreId = userCentre._id;
    }

    const litige = await litigeService.ajouterPieceJointe(
      req.params.id,
      req.user.id,
      req.user.role,
      req.body,
      centreId
    );

    return res.status(201).json({
      success: true,
      message: 'Pièce jointe ajoutée',
      data: litige,
    });
  } catch (error) {
    return next(error);
  }
};

// POST /api/litiges/:id/notes - Ajouter une note interne (admin)
const ajouterNote = async (req, res, next) => {
  try {
    ensureId(req.params.id);

    const { contenu } = req.body;

    if (!contenu) {
      throw createError(400, 'contenu est obligatoire');
    }

    const litige = await litigeService.ajouterNoteInterne(req.params.id, req.user.id, contenu);

    return res.status(201).json({
      success: true,
      message: 'Note interne ajoutée',
      data: litige,
    });
  } catch (error) {
    return next(error);
  }
};

// PATCH /api/litiges/:id/cloturer - Clôturer un litige (admin)
const cloturerLitige = async (req, res, next) => {
  try {
    ensureId(req.params.id);

    const { decisionFinale } = req.body;

    if (!decisionFinale) {
      throw createError(400, 'decisionFinale est obligatoire');
    }

    const litige = await litigeService.cloturerLitige(req.params.id, decisionFinale);

    return res.status(200).json({
      success: true,
      message: 'Litige clôturé',
      data: litige,
    });
  } catch (error) {
    return next(error);
  }
};

// PATCH /api/litiges/:id/archiver - Archiver un litige (admin)
const archiverLitige = async (req, res, next) => {
  try {
    ensureId(req.params.id);

    const litige = await litigeService.archiverLitige(req.params.id);

    return res.status(200).json({
      success: true,
      message: 'Litige archivé',
      data: litige,
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  createLitige,
  listLitiges,
  getMesLitiges,
  getLitigeById,
  updateLitigeStatus,
  assignerResponsable,
  ajouterMessage,
  ajouterPieceJointe,
  ajouterNote,
  cloturerLitige,
  archiverLitige,
};
