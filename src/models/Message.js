const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
      index: true,
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    senderRole: {
      type: String,
      enum: ['apprenant', 'centre', 'admin'],
      required: true,
    },
    content: {
      type: String,
      default: '',
      trim: true,
      maxlength: 5000,
    },
    attachments: {
      type: [
        {
          id: { type: mongoose.Schema.Types.ObjectId, required: true },
          originalName: { type: String, required: true, trim: true, maxlength: 255 },
          storedName: { type: String, required: true, trim: true, maxlength: 255 },
          mimeType: { type: String, required: true, trim: true, maxlength: 200 },
          size: { type: Number, required: true, min: 1 },
          url: { type: String, required: true, trim: true, maxlength: 500 },
          createdAt: { type: Date, default: Date.now },
        },
      ],
      default: [],
    },
    clientMessageId: {
      type: String,
      trim: true,
      maxlength: 100,
      default: undefined,
    },
  },
  { timestamps: true }
);

messageSchema.index({ conversationId: 1, createdAt: 1 });
messageSchema.index(
  { conversationId: 1, clientMessageId: 1 },
  { unique: true, partialFilterExpression: { clientMessageId: { $type: 'string' } } }
);

module.exports = mongoose.model('Message', messageSchema);
