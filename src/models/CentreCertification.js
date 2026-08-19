const mongoose = require('mongoose');

const centreCertificationSchema = new mongoose.Schema(
  {
    centreId: { type: mongoose.Schema.Types.ObjectId, ref: 'Centre', required: true, index: true },
    nom: { type: String, required: true, trim: true, maxlength: 200 },
    dateObtention: { type: Date, required: true },
    organisme: { type: String, required: true, trim: true, maxlength: 200 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('CentreCertification', centreCertificationSchema);