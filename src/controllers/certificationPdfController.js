const createError = require('http-errors');
const PDFDocument = require('pdfkit');
const Certification = require('../models/Certification');
const User = require('../models/User');
const Formation = require('../models/Formation');
const Centre = require('../models/Centre');

const getCertificationPdf = async (req, res, next) => {
  try {
    const certification = await Certification.findById(req.params.id)
      .populate('apprenant', 'nom prenom email')
      .populate('formation', 'title')
      .populate('centre', 'name')
      .lean();

    if (!certification) throw createError(404, 'Certification introuvable');
    if (certification.status === 'revoquee') throw createError(409, 'Certificat révoqué');

    if (req.user.role !== 'admin' && certification.apprenant._id.toString() !== req.user.id.toString()) {
      throw createError(403, 'Accès interdit');
    }

    const doc = new PDFDocument({ margin: 50 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="certificat-${certification.numeroCertificat}.pdf"`);

    doc.pipe(res);
    doc.fontSize(26).text('SkillBridge', { align: 'center' });
    doc.moveDown();
    doc.fontSize(18).text('Certificat de formation', { align: 'center' });
    doc.moveDown(2);
    doc.fontSize(12).text(`Numéro : ${certification.numeroCertificat}`);
    doc.text(`Apprenant : ${certification.apprenant?.nom || ''} ${certification.apprenant?.prenom || ''}`);
    doc.text(`Formation : ${certification.formation?.title || ''}`);
    doc.text(`Centre : ${certification.centre?.name || ''}`);
    doc.text(`Date d’émission : ${new Date(certification.dateObtention || certification.createdAt).toLocaleDateString('fr-FR')}`);
    doc.text(`Référence de vérification : ${certification.numeroCertificat}`);
    doc.text(`Statut : ${certification.status}`);
    doc.end();
  } catch (error) {
    return next(error);
  }
};

module.exports = { getCertificationPdf };
