const express = require('express');
const router = express.Router();
const certificationPdfController = require('../controllers/certificationPdfController');
const { authenticate } = require('../middleware/authMiddleware');

router.get('/:id/pdf', authenticate, certificationPdfController.getCertificationPdf);

module.exports = router;
