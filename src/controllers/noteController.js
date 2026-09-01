const createError = require('http-errors');
const mongoose = require('mongoose');
const noteService = require('../services/noteService');

const ensureId = (id) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw createError(400, 'ID invalide');
  }
};

const createNote = async (req, res, next) => {
  try {
    const { centreId, formationId, note, commentaire = '' } = req.body;

    if (!centreId || note === undefined || note === null) {
      throw createError(400, 'centreId et note sont obligatoires');
    }

    if (note < 1 || note > 5) {
      throw createError(400, 'note doit être entre 1 et 5');
    }

    ensureId(centreId);
    if (formationId) {
      ensureId(formationId);
    }

    const newNote = await noteService.createNote(req.user.id, centreId, formationId || null, {
      note,
      commentaire,
    });

    return res.status(201).json({
      success: true,
      message: 'Note créée avec succès',
      data: newNote,
    });
  } catch (error) {
    return next(error);
  }
};

const getNotesBycentre = async (req, res, next) => {
  try {
    const { page, limit } = req.query;

    ensureId(req.params.centreId);

    const result = await noteService.getNotesBycentre(req.params.centreId, {
      page,
      limit,
    });

    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    return next(error);
  }
};

const getAverageNote = async (req, res, next) => {
  try {
    ensureId(req.params.centreId);

    const average = await noteService.getAverageNote(req.params.centreId);

    return res.status(200).json({
      success: true,
      data: average,
    });
  } catch (error) {
    return next(error);
  }
};

const getNoteById = async (req, res, next) => {
  try {
    ensureId(req.params.id);

    const note = await noteService.getNoteById(req.params.id);

    // Vérifier les droits: auteur ou admin
    if (req.user.role !== 'admin' && note.apprenant._id.toString() !== req.user.id.toString()) {
      throw createError(403, 'Accès interdit');
    }

    return res.status(200).json({ success: true, data: note });
  } catch (error) {
    return next(error);
  }
};

const updateNote = async (req, res, next) => {
  try {
    ensureId(req.params.id);

    const { note, commentaire } = req.body;

    if (note !== undefined && (note < 1 || note > 5)) {
      throw createError(400, 'note doit être entre 1 et 5');
    }

    const updatedNote = await noteService.updateNote(req.params.id, req.user.id, {
      note,
      commentaire,
    });

    return res.status(200).json({
      success: true,
      message: 'Note mise à jour avec succès',
      data: updatedNote,
    });
  } catch (error) {
    return next(error);
  }
};

const deleteNote = async (req, res, next) => {
  try {
    ensureId(req.params.id);

    await noteService.deleteNote(req.params.id, req.user.id);

    return res.status(200).json({
      success: true,
      message: 'Note supprimée avec succès',
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  createNote,
  getNotesBycentre,
  getAverageNote,
  getNoteById,
  updateNote,
  deleteNote,
};
