const mongoose = require('mongoose');
const crypto = require('crypto');

const certificationSchema = new mongoose.Schema(
  {
    apprenant: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    formation: { type: mongoose.Schema.Types.ObjectId, ref: 'Formation', required: true, index: true },
    centre: { type: mongoose.Schema.Types.ObjectId, ref: 'Centre', required: true, index: true },
    dateObtention: { type: Date, required: true },
    numeroCertificat: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
      maxlength: 50,
    },
    fileUrl: { type: String, trim: true, maxlength: 500, default: '' },
    pdfGenere: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ['emise', 'revoquee'],
      default: 'emise',
      index: true,
    },
  },
  { timestamps: true }
);

// Générer automatiquement un numéro de certificat unique avant sauvegarde
certificationSchema.pre('validate', async function preValidate() {
  if (this.isNew && !this.numeroCertificat) {
    let numeroCertificat;
    let exists = true;

    // Générer un numéro unique
    while (exists) {
      numeroCertificat = `CERT-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
      const existingCert = await mongoose.model('Certification').findOne({ numeroCertificat });
      exists = !!existingCert;
    }

    this.numeroCertificat = numeroCertificat;
  }

});

// Un apprenant ne peut recevoir qu'un certificat par formation.
certificationSchema.index({ apprenant: 1, formation: 1 }, { unique: true });
certificationSchema.index({ numeroCertificat: 1, status: 1 });

module.exports = mongoose.model('Certification', certificationSchema);
