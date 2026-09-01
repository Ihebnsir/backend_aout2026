const CentreNote = require('../models/CentreNote');
const Reservation = require('../models/Reservation');
const createError = require('http-errors');

const sanitizeNote = (note) => {
  if (!note) return null;
  const noteObj = note.toObject ? note.toObject() : { ...note };
  delete noteObj.__v;
  return noteObj;
};

const isFormationCompleted = async (formationId, apprenantId) => {
  const reservation = await Reservation.findOne({
    formationId,
    learnerId: apprenantId,
    status: 'COMPLETED',
  });

  return !!reservation;
};

const createNote = async (apprenantId, centreId, formationId, { note, commentaire = '' }) => {
  // Vérifier que la formation est terminée
  if (formationId) {
    const isCompleted = await isFormationCompleted(formationId, apprenantId);
    if (!isCompleted) {
      throw createError(400, 'Formation non complétée ou introuvable');
    }

    // Vérifier qu'une note n'existe pas déjà pour cette combinaison
    const existingNote = await CentreNote.findOne({
      apprenant: apprenantId,
      formation: formationId,
    });

    if (existingNote) {
      throw createError(409, 'Vous avez déjà noté cette formation');
    }
  }

  const newNote = await CentreNote.create({
    apprenant: apprenantId,
    centre: centreId,
    formation: formationId || null,
    note,
    commentaire,
  });

  return sanitizeNote(newNote);
};

const getNotesBycentre = async (centreId, { page = 1, limit = 10 } = {}) => {
  const normalizedLimit = Math.max(1, Number(limit));
  const normalizedPage = Math.max(1, Number(page));

  const total = await CentreNote.countDocuments({ centre: centreId });
  const notes = await CentreNote.find({ centre: centreId })
    .populate('apprenant', 'nom prenom')
    .populate('formation', 'title')
    .sort({ createdAt: -1 })
    .skip((normalizedPage - 1) * normalizedLimit)
    .limit(normalizedLimit)
    .lean();

  return {
    data: notes.map(sanitizeNote),
    pagination: {
      page: normalizedPage,
      limit: normalizedLimit,
      total,
      pages: Math.max(1, Math.ceil(total / normalizedLimit)),
    },
  };
};

const getAverageNote = async (centreId) => {
  const result = await CentreNote.aggregate([
    { $match: { centre: require('mongoose').Types.ObjectId(centreId) } },
    {
      $group: {
        _id: '$centre',
        moyenneNote: { $avg: '$note' },
        totalNotes: { $sum: 1 },
      },
    },
  ]);

  if (result.length === 0) {
    return {
      moyenneNote: 0,
      totalNotes: 0,
    };
  }

  return {
    moyenneNote: Math.round(result[0].moyenneNote * 10) / 10,
    totalNotes: result[0].totalNotes,
  };
};

const getNoteById = async (noteId) => {
  const note = await CentreNote.findById(noteId)
    .populate('apprenant', 'nom prenom email')
    .populate('centre', 'name')
    .populate('formation', 'title')
    .lean();

  if (!note) {
    throw createError(404, 'Note introuvable');
  }

  return sanitizeNote(note);
};

const updateNote = async (noteId, apprenantId, { note, commentaire }) => {
  // Vérifier que l'apprenant est bien l'auteur
  const existingNote = await CentreNote.findById(noteId);
  if (!existingNote || existingNote.apprenant.toString() !== apprenantId.toString()) {
    throw createError(403, 'Accès interdit');
  }

  const updatedNote = await CentreNote.findByIdAndUpdate(
    noteId,
    { note, commentaire },
    { new: true, runValidators: true }
  ).lean();

  return sanitizeNote(updatedNote);
};

const deleteNote = async (noteId, apprenantId) => {
  // Vérifier que l'apprenant est bien l'auteur
  const existingNote = await CentreNote.findById(noteId);
  if (!existingNote || existingNote.apprenant.toString() !== apprenantId.toString()) {
    throw createError(403, 'Accès interdit');
  }

  const deletedNote = await CentreNote.findByIdAndDelete(noteId).lean();

  return sanitizeNote(deletedNote);
};

module.exports = {
  createNote,
  getNotesBycentre,
  getAverageNote,
  getNoteById,
  updateNote,
  deleteNote,
};
