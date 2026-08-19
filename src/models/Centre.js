const mongoose = require('mongoose');

const centreSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    name: { type: String, required: true, trim: true, maxlength: 150 },
    responsable: { type: String, trim: true, maxlength: 150, default: '' },
    description: { type: String, trim: true, maxlength: 2000, default: '' },
    domaine: { type: String, trim: true, maxlength: 150, default: '' },
    ville: { type: String, trim: true, maxlength: 100, default: '' },
    adresse: { type: String, trim: true, maxlength: 250, default: '' },
    email: { type: String, trim: true, lowercase: true, maxlength: 254, default: '' },
    telephone: { type: String, trim: true, maxlength: 30, default: '' },
    siteWeb: { type: String, trim: true, maxlength: 500, default: '' },
    logo: { type: String, trim: true, default: '' },
    cover: { type: String, trim: true, default: '' },
    image: { type: String, trim: true, default: '' },
    gallery: { type: [String], default: [] },
    reseauxSociaux: {
      facebook: { type: String, trim: true, default: '' },
      linkedin: { type: String, trim: true, default: '' },
      twitter: { type: String, trim: true, default: '' },
    },
    coordonneesGPS: {
      lat: { type: Number, min: -90, max: 90 },
      lng: { type: Number, min: -180, max: 180 },
    },
    statutVerification: {
      type: String,
      enum: ['NON_SOUMIS', 'EN_ATTENTE', 'DOCUMENTS_RECUS', 'VERIFIE', 'REJETE', 'SUSPENDU'],
      default: 'NON_SOUMIS',
      index: true,
    },
    dateDemande: { type: Date, default: null },
    dateValidation: { type: Date, default: null },
    motifRejet: { type: String, trim: true, maxlength: 1000, default: null },
    verifie: { type: Boolean, default: false },
    profileCompletion: { type: Number, min: 0, max: 100, default: 0 },
    checklist: {
      logo: { type: Boolean, default: false },
      adresse: { type: Boolean, default: false },
      telephone: { type: Boolean, default: false },
      email: { type: Boolean, default: false },
      description: { type: Boolean, default: false },
      documents: { type: Boolean, default: false },
      certifications: { type: Boolean, default: false },
      reseauxSociaux: { type: Boolean, default: false },
    },
  },
  { timestamps: true }
);

centreSchema.index({ ville: 1 });
centreSchema.index({ domaine: 1 });

module.exports = mongoose.model('Centre', centreSchema);