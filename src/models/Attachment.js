const mongoose = require('mongoose');

const attachmentSchema = new mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
      index: true,
    },
    uploaderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    originalName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 255,
    },
    storedName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 255,
    },
    storageKey: {
      type: String,
      required: true,
      trim: true,
      maxlength: 512,
    },
    storageProvider: {
      type: String,
      enum: ['local', 'r2'],
      default: 'local',
      required: true,
    },
    mimeType: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    size: {
      type: Number,
      required: true,
      min: 1,
    },
    url: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  { timestamps: true }
);

attachmentSchema.index({ conversationId: 1, uploaderId: 1, createdAt: -1 });

module.exports = mongoose.model('Attachment', attachmentSchema);
