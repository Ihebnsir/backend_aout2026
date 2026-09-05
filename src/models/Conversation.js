const mongoose = require('mongoose');

const lastMessageSchema = new mongoose.Schema(
  {
    messageId: { type: mongoose.Schema.Types.ObjectId, ref: 'Message', default: null },
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    contentPreview: { type: String, trim: true, maxlength: 200, default: '' },
    createdAt: { type: Date, default: null },
  },
  { _id: false }
);

const conversationSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['direct', 'support'],
      required: true,
      index: true,
    },
    learnerUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    centreUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    centreId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Centre',
      default: null,
      index: true,
    },
    formationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Formation',
      default: null,
      index: true,
    },
    directKey: {
      type: String,
      default: null,
    },
    activeSupportKey: {
      type: String,
      default: null,
    },
    subject: {
      type: String,
      trim: true,
      maxlength: 200,
      default: null,
    },
    status: {
      type: String,
      enum: ['open', 'pending', 'resolved', 'closed'],
      default: null,
      index: true,
    },
    lastMessage: {
      type: lastMessageSchema,
      default: () => ({}),
    },
    lastMessageAt: {
      type: Date,
      default: null,
      index: true,
    },
    unreadCounts: {
      type: Map,
      of: { type: Number, min: 0 },
      default: () => new Map(),
    },
  },
  { timestamps: true }
);

conversationSchema.index({ directKey: 1 }, { unique: true, sparse: true });
conversationSchema.index({ activeSupportKey: 1 }, { unique: true, sparse: true });
conversationSchema.index({ learnerUserId: 1, lastMessageAt: -1 });
conversationSchema.index({ centreUserId: 1, lastMessageAt: -1 });
conversationSchema.index({ type: 1, status: 1, lastMessageAt: -1 });

module.exports = mongoose.model('Conversation', conversationSchema);
