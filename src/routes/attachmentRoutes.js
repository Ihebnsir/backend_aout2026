const express = require('express');
const multer = require('multer');
const { authenticate } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');
const attachmentController = require('../controllers/attachmentController');

const router = express.Router();
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: Number(process.env.MAX_ATTACHMENT_SIZE || 10 * 1024 * 1024),
    files: 1,
  },
});

router.post('/:id/attachments', authenticate, upload.single('file'), attachmentController.uploadAttachment);
router.get('/:conversationId/attachments/:attachmentId', authenticate, attachmentController.downloadAttachment);

module.exports = router;
