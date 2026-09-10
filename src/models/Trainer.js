const mongoose = require('mongoose');

const trainerSchema = new mongoose.Schema(
  {
    centre: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Centre',
      required: true,
      index: true,
    },
    nom: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    prenom: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
    },
    telephone: {
      type: String,
      default: '',
      trim: true,
      maxlength: 30,
    },
    specialite: {
      type: String,
      default: '',
      trim: true,
      maxlength: 200,
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
      index: true,
    },
  },
  { timestamps: true }
);

trainerSchema.index({ centre: 1, email: 1 }, { unique: true });

module.exports = mongoose.model('Trainer', trainerSchema);
