const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema(
  {
    formation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Formation',
      required: true,
      index: true,
    },
    centre: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Centre',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: '',
    },
    date: {
      type: Date,
      required: true,
    },
    startTime: {
      type: String,
      trim: true,
      default: '',
      maxlength: 20,
    },
    endTime: {
      type: String,
      trim: true,
      default: '',
      maxlength: 20,
    },
    location: {
      type: String,
      trim: true,
      default: '',
      maxlength: 200,
    },
    meetingUrl: {
      type: String,
      trim: true,
      default: '',
      maxlength: 500,
    },
    status: {
      type: String,
      enum: ['scheduled', 'ongoing', 'completed', 'cancelled'],
      default: 'scheduled',
      index: true,
    },
  },
  { timestamps: true }
);

sessionSchema.index({ formation: 1, date: 1 });
sessionSchema.index({ centre: 1, status: 1 });

module.exports = mongoose.model('Session', sessionSchema);
