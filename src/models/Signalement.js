const mongoose = require('mongoose');

const signalementSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['Contenu inapproprié', 'Fausse information', 'Spam', 'Harcelement', 'Problème technique'],
      required: true,
      index: true,
    },
    contenu: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },
    status: {
      type: String,
      enum: ['En attente', 'En cours', 'Résolu'],
      default: 'En attente',
      index: true,
    },
    reporter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    cibleType: {
      type: String,
      enum: ['formation', 'centre', 'commentaire', 'message', 'autre'],
      default: 'autre',
    },
    cibleId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    traitePar: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    resolutionNote: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: null,
    },
    litigeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Litige',
      default: null,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Index composé pour recherche rapide
signalementSchema.index({ reporter: 1, createdAt: -1 });
signalementSchema.index({ traitePar: 1, status: 1 });

module.exports = mongoose.model('Signalement', signalementSchema);
