const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      enum: ['admin', 'centre', 'apprenant'],
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
      // userId est requis si role n'est pas 'admin'
      validate: {
        validator(value) {
          if (this.role === 'admin') {
            return value === null || value === undefined;
          }
          return value !== null && value !== undefined;
        },
        message: 'userId doit être null pour role admin, et requis pour centre/apprenant',
      },
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },
    category: {
      type: String,
      enum: [
        'users',
        'centres',
        'formations',
        'signalements',
        'paiements',
        'system',
        'partenariats',
        'litiges',
        'reservations',
        'messages',
        'certificats',
        'documents',
        'sessions',
      ],
      required: true,
      index: true,
    },
    lu: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Index composé pour accélérer les requêtes de liste/comptage
notificationSchema.index({ role: 1, userId: 1, lu: 1 });
notificationSchema.index({ role: 1, userId: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
