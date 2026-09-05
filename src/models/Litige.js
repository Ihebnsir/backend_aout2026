const mongoose = require('mongoose');

const litigeSchema = new mongoose.Schema(
  {
    numeroDossier: {
      type: String,
      unique: true,
      required: true,
      index: true,
      trim: true,
    },
    titre: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 5000,
    },
    categorie: {
      type: String,
      enum: [
        'Remboursement',
        'Réservation',
        'Certificat',
        'Paiement',
        'Absence formateur',
        'Inscription',
        'Qualité formation',
        'Communication',
        'Retard',
        'Annulation',
      ],
      required: true,
      index: true,
    },
    priorite: {
      type: String,
      enum: ['basse', 'moyenne', 'haute', 'critique'],
      default: 'moyenne',
      index: true,
    },
    statut: {
      type: String,
      enum: ['ouvert', 'analyse', 'attente_justificatifs', 'en_cours', 'decision', 'resolu', 'archive'],
      default: 'ouvert',
      index: true,
    },
    responsable: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    etudiant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      immutable: true,
      index: true,
    },
    centre: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Centre',
      required: true,
      immutable: true,
      index: true,
    },
    formation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Formation',
      default: null,
      immutable: true,
    },
    reservation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Reservation',
      default: null,
      immutable: true,
    },
    piecesJointes: [
      {
        nom: String,
        type: String,
        url: String,
        taille: String,
        uploadedAt: { type: Date, default: Date.now },
      },
    ],
    conversation: [
      {
        auteur: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: true,
        },
        role: {
          type: String,
          enum: ['apprenant', 'etudiant', 'centre', 'admin', 'system'],
          required: true,
        },
        message: String,
        createdAt: { type: Date, default: Date.now },
      },
    ],
    historique: [
      {
        date: { type: Date, default: Date.now },
        action: String,
        auteur: String,
        details: String,
      },
    ],
    notesInternes: [
      {
        auteur: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: true,
        },
        contenu: String,
        createdAt: { type: Date, default: Date.now },
      },
    ],
    decisionFinale: {
      type: String,
      default: null,
      maxlength: 2000,
    },
    signalementOrigine: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Signalement',
      default: null,
    },
    aiAnalysis: {
      risque: String,
      recommandation: String,
      confiance: Number,
      alerte: String,
    },
  },
  {
    timestamps: true,
  }
);

// Index composé pour recherche rapide
litigeSchema.index({ etudiant: 1, statut: 1 });
litigeSchema.index({ centre: 1, statut: 1 });
litigeSchema.index({ responsable: 1, statut: 1 });
litigeSchema.index({ priorite: 1, statut: 1 });
litigeSchema.index({ createdAt: -1 });
litigeSchema.index(
  { signalementOrigine: 1 },
  { unique: true, partialFilterExpression: { signalementOrigine: { $type: 'objectId' } } }
);

module.exports = mongoose.model('Litige', litigeSchema);
