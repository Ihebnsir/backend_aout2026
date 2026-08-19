const mongoose = require('mongoose');

const centreHistorySchema = new mongoose.Schema(
  {
    centreId: { type: mongoose.Schema.Types.ObjectId, ref: 'Centre', required: true, index: true },
    action: { type: String, required: true, trim: true, maxlength: 100 },
    details: { type: String, trim: true, maxlength: 2000, default: '' },
    date: { type: Date, default: Date.now },
    adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('CentreHistory', centreHistorySchema);