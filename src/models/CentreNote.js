const mongoose = require('mongoose');

const centreNoteSchema = new mongoose.Schema(
  {
    centreId: { type: mongoose.Schema.Types.ObjectId, ref: 'Centre', required: true, index: true },
    auteurId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    contenu: { type: String, required: true, trim: true, maxlength: 2000 },
    date: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model('CentreNote', centreNoteSchema);