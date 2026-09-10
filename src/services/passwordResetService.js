const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const createError = require('http-errors');
const User = require('../models/User');
const PasswordReset = require('../models/PasswordReset');
const emailService = require('./emailService');

const OTP_TTL_MS = 15 * 60 * 1000;
const RESET_TOKEN_TTL_MS = 15 * 60 * 1000;
const REQUEST_WINDOW_MS = 15 * 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 3;
const MAX_ATTEMPTS = 5;
const DUMMY_CODE_HASH = '$2b$10$7EqJtq98hPqEX7fNZaFWoO5uO6Qw8FQ8w0o4LrJrM8eK0d2e3aYyW';
let sendEmail = (...args) => emailService.sendEmail(...args);

const normalizeEmail = (email) => (typeof email === 'string' ? email.toLowerCase().trim() : '');
const hashSecret = (secret) => crypto.createHash('sha256').update(secret).digest('hex');
const generateCode = () => crypto.randomInt(100000, 1000000).toString();
const generateResetToken = () => crypto.randomBytes(32).toString('hex');
const getRequestIp = (req) => req.ip || req.socket?.remoteAddress || 'unknown';

const genericResponse = {
  success: true,
  message: 'Si cette adresse existe, un code de réinitialisation a été envoyé.',
};

const sendResetEmail = async (user, code) => {
  const text = `Bonjour ${user.prenom},\n\nUne demande de réinitialisation de votre mot de passe SkillBridge a été effectuée.\n\nVotre code de vérification est : ${code}\n\nCe code expire dans 15 minutes. Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet email.\n\nL'équipe SkillBridge`;
  const html = `<!DOCTYPE html>
<html lang="fr">
<body style="font-family:Arial,sans-serif;line-height:1.6;color:#243047;background:#f4f7fb;padding:24px">
  <div style="max-width:560px;margin:auto;background:#fff;padding:32px;border-radius:8px">
    <h1 style="color:#1c4d8c">SkillBridge</h1>
    <p>Bonjour <strong>${user.prenom}</strong>,</p>
    <p>Une demande de réinitialisation de votre mot de passe a été effectuée.</p>
    <p style="font-size:28px;letter-spacing:4px;font-weight:bold;text-align:center">${code}</p>
    <p>Ce code expire dans <strong>15 minutes</strong>.</p>
    <p>Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet email.</p>
    <p>L'équipe SkillBridge</p>
  </div>
</body>
</html>`;

  return sendEmail({
    to: user.email,
    subject: 'SkillBridge - Code de réinitialisation du mot de passe',
    text,
    html,
  });
};

const requestPasswordReset = async ({ email, requestIp }) => {
  const normalizedEmail = normalizeEmail(email);
  const since = new Date(Date.now() - REQUEST_WINDOW_MS);
  const recentRequests = await PasswordReset.countDocuments({
    requestIp,
    createdAt: { $gte: since },
  });

  if (recentRequests >= MAX_REQUESTS_PER_WINDOW) return genericResponse;

  await PasswordReset.updateMany(
    { email: normalizedEmail, usedAt: null, revokedAt: null },
    { $set: { revokedAt: new Date() } }
  );

  const user = await User.findOne({ email: normalizedEmail });
  const code = user ? generateCode() : null;
  const resetRequest = await PasswordReset.create({
    user: user?._id || null,
    email: normalizedEmail,
    requestIp,
    codeHash: code ? await bcrypt.hash(code, 10) : null,
    expiresAt: new Date(Date.now() + OTP_TTL_MS),
    maxAttempts: MAX_ATTEMPTS,
  });

  if (user) {
    try {
      await sendResetEmail(user, code);
    } catch (error) {
      await PasswordReset.updateOne({ _id: resetRequest._id }, { $set: { revokedAt: new Date() } });
    }
  }

  return genericResponse;
};

const findActiveRequest = async (email) => PasswordReset.findOne({
  email,
  usedAt: null,
  revokedAt: null,
  verifiedAt: null,
  expiresAt: { $gt: new Date() },
}).sort({ createdAt: -1 }).select('+codeHash +resetTokenHash');

const verifyResetCode = async ({ email, code }) => {
  const normalizedEmail = normalizeEmail(email);
  const resetRequest = await findActiveRequest(normalizedEmail);
  const codeMatches = await bcrypt.compare(code, resetRequest?.codeHash || DUMMY_CODE_HASH);

  if (!resetRequest || !codeMatches) {
    if (resetRequest) {
      resetRequest.attempts += 1;
      if (resetRequest.attempts >= resetRequest.maxAttempts) resetRequest.revokedAt = new Date();
      await resetRequest.save();
    }
    throw createError(400, 'Code de réinitialisation invalide ou expiré');
  }

  const resetToken = generateResetToken();
  resetRequest.verifiedAt = new Date();
  resetRequest.resetTokenHash = hashSecret(resetToken);
  resetRequest.expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);
  await resetRequest.save();

  return { resetToken, expiresIn: Math.floor(RESET_TOKEN_TTL_MS / 1000) };
};

const resetPassword = async ({ resetToken, newPassword }) => {
  const resetRequest = await PasswordReset.findOne({
    resetTokenHash: hashSecret(resetToken),
    verifiedAt: { $ne: null },
    usedAt: null,
    revokedAt: null,
    expiresAt: { $gt: new Date() },
  }).select('+resetTokenHash');

  if (!resetRequest) throw createError(400, 'Jeton de réinitialisation invalide ou expiré');

  const claimedRequest = await PasswordReset.findOneAndUpdate(
    { _id: resetRequest._id, usedAt: null, revokedAt: null, expiresAt: { $gt: new Date() } },
    { $set: { usedAt: new Date() } },
    { new: true }
  );
  if (!claimedRequest) throw createError(400, 'Jeton de réinitialisation invalide ou expiré');

  const user = await User.findById(resetRequest.user).select('+password');
  if (!user) throw createError(400, 'Jeton de réinitialisation invalide ou expiré');
  user.password = newPassword;
  await user.save();
};

module.exports = {
  requestPasswordReset,
  verifyResetCode,
  resetPassword,
  normalizeEmail,
  getRequestIp,
  setEmailSender: (sender) => {
    sendEmail = sender || ((...args) => emailService.sendEmail(...args));
  },
};