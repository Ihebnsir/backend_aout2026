const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema(
  {
    session: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Session',
      required: true,
      index: true,
    },
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
    centre: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Centre',
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['present', 'absent', 'late'],
      required: true,
      index: true,
    },
    markedAt: {
      type: Date,
      default: Date.now,
    },
    markedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    note: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: '',
    },
  },
  { timestamps: true }
);

attendanceSchema.index({ session: 1, learner: 1 }, { unique: true });
attendanceSchema.index({ centre: 1, formation: 1 });

module.exports = mongoose.model('Attendance', attendanceSchema);
