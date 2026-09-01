const mongoose = require('mongoose');

const reservationSchema = new mongoose.Schema(
  {
    learnerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    formationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Formation',
      required: true,
      index: true,
    },
    centreId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Centre',
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED'],
      default: 'PENDING',
      index: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    paid: {
      type: Boolean,
      default: false,
    },
    paymentDate: {
      type: Date,
      default: null,
    },
    paymentMethod: {
      type: String,
      default: null,
    },
    transactionId: {
      type: String,
      default: null,
    },
    history: [
      {
        date: {
          type: Date,
          default: Date.now,
        },
        action: {
          type: String,
          required: true,
        },
        icon: {
          type: String,
          default: null,
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Index unique : un apprenant ne peut avoir qu'une réservation active par formation
reservationSchema.index(
  { learnerId: 1, formationId: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: { $in: ['PENDING', 'CONFIRMED'] },
    },
  }
);

// Initialiser l'historique à la création
reservationSchema.pre('save', function (next) {
  if (this.isNew && this.history.length === 0) {
    this.history.push({
      date: new Date(),
      action: 'Réservation créée',
      icon: 'create',
    });
  }
  next();
});

module.exports = mongoose.model('Reservation', reservationSchema);
