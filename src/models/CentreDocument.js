const mongoose = require('mongoose');

const centreDocumentSchema = new mongoose.Schema(
  {
    centre: { type: mongoose.Schema.Types.ObjectId, ref: 'Centre', required: true, index: true },
    type: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
      enum: ['registre_commerce', 'diplome_formateur', 'autorisation', 'assurance', 'certification', 'autre'],
    },
    fileUrl: { type: String, required: true, trim: true, maxlength: 500 },
    status: {
      type: String,
      enum: ['en_attente', 'valide', 'refuse'],
      default: 'en_attente',
      index: true,
    },
    commentaireAdmin: { type: String, trim: true, maxlength: 2000, default: '' },
    uploadedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Index pour rapide recherche
centreDocumentSchema.index({ centre: 1, status: 1 });

module.exports = mongoose.model('CentreDocument', centreDocumentSchema);