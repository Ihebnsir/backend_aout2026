const mongoose = require('mongoose');

const progressSchema = new mongoose.Schema(
  {
    learner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    formation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Formation',
      required: true,
      index: true,
    },
    reservation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Reservation',
      required: true,
      index: true,
    },
    centre: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Centre',
      required: true,
      index: true,
    },
    percentage: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    completedSessions: {
      type: Number,
      min: 0,
      default: 0,
    },
    totalSessions: {
      type: Number,
      min: 0,
      default: 0,
    },
    status: {
      type: String,
      enum: ['not-started', 'in-progress', 'completed'],
      default: 'not-started',
      index: true,
    },
    lastActivityAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

progressSchema.index({ learner: 1, formation: 1 }, { unique: true });
progressSchema.index({ centre: 1, status: 1 });

module.exports = mongoose.model('Progress', progressSchema);
