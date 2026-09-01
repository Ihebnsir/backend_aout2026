const mongoose = require('mongoose');

const centreNoteSchema = new mongoose.Schema(
  {
    apprenant: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    centre: { type: mongoose.Schema.Types.ObjectId, ref: 'Centre', required: true, index: true },
    formation: { type: mongoose.Schema.Types.ObjectId, ref: 'Formation', default: null },
    note: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    commentaire: { type: String, trim: true, maxlength: 2000, default: '' },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Unique compound index: un apprenant ne peut noter qu'une fois par formation
centreNoteSchema.index({ apprenant: 1, formation: 1 }, { unique: true, sparse: true });

// Index pour recherche rapide
centreNoteSchema.index({ centre: 1, createdAt: -1 });

module.exports = mongoose.model('CentreNote', centreNoteSchema);