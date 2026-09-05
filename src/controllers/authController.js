const jwt = require('jsonwebtoken');
const createError = require('http-errors');
const User = require('../models/User');
const centreService = require('../services/centreService');
const notificationService = require('../services/notificationService');
const emailService = require('../services/emailService');
const { getJwtSecret } = require('../middleware/authMiddleware');

const sanitizeUser = (user) => {
  const sanitizedUser = user.toObject ? user.toObject() : { ...user };
  delete sanitizedUser.password;
  delete sanitizedUser.__v;
  sanitizedUser.id = user._id.toString();
  return sanitizedUser;
};

const signToken = (user) => {
  const jwtSecret = getJwtSecret();
  if (!jwtSecret) {
    throw createError(503, 'Service d\'authentification indisponible');
  }

  return jwt.sign(
    {
      userId: user._id,
      id: user._id,
      role: user.role,
      email: user.email,
    },
    jwtSecret,
    { expiresIn: '1h' }
  );
};

const register = async (req, res, next) => {
  let user;

  try {
    const role = req.body.role || 'apprenant';
    const isCentre = role === 'centre';
    const userPayload = {
      nom: isCentre ? req.body.name : req.body.nom,
      prenom: isCentre ? req.body.responsable : req.body.prenom,
      email: req.body.email,
      password: req.body.password,
      telephone: req.body.telephone || '',
      ville: req.body.ville || '',
      role,
    };

    user = await User.create(userPayload);

    if (isCentre) {
      const {
        name,
        responsable,
        matriculeFiscal,
        numeroRNE,
        adresse,
        description,
        domaine,
        ville,
        telephone,
        email,
        siteWeb,
        ...ignored
      } = req.body;

      await centreService.createCentre(
        {
          name,
          responsable,
          matriculeFiscal,
          numeroRNE,
          adresse,
          description,
          domaine,
          ville,
          telephone,
          email,
          siteWeb,
        },
        user._id
      );
    }

    try {
      await notificationService.notifyAdmins(
        'Nouvel utilisateur inscrit',
        `${user.prenom} ${user.nom} vient de créer un compte ${user.role}.`,
        'users'
      );
    } catch (error) {
      // best effort only
    }

    console.log('[EMAIL DEBUG] Registration successful');
    try {
      const plainText = `Bonjour ${user.prenom},\n\nBienvenue sur SkillBridge!\n\nVotre compte a été créé avec succès.\n\nVous pouvez maintenant accéder à votre espace et découvrir les formations disponibles.\n\nCordialement,\nL'équipe SkillBridge`;

      const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bienvenue sur SkillBridge</title>
</head>
<body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5;">
  <div style="max-width: 600px; margin: 20px auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); overflow: hidden;">
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; text-align: center;">
      <h1 style="margin: 0; color: #ffffff; font-size: 28px;">SkillBridge</h1>
      <p style="margin: 8px 0 0 0; color: #e0e0e0; font-size: 14px;">Plateforme de Formations</p>
    </div>

    <!-- Content -->
    <div style="padding: 40px 30px;">
      <p style="margin: 0 0 20px 0; font-size: 16px;">Bonjour <strong>${user.prenom}</strong>,</p>
      
      <p style="margin: 0 0 20px 0; font-size: 16px;">Bienvenue sur <strong>SkillBridge</strong>!</p>
      
      <p style="margin: 0 0 20px 0; font-size: 16px;">Votre compte a été créé avec succès et vous pouvez dès maintenant:</p>
      
      <ul style="margin: 0 0 20px 0; padding-left: 20px; font-size: 16px;">
        <li style="margin-bottom: 10px;">Accéder à votre espace personnel</li>
        <li style="margin-bottom: 10px;">Découvrir les formations disponibles</li>
        <li style="margin-bottom: 10px;">Vous inscrire à des sessions de formation</li>
        <li>Suivre votre progression et vos certifications</li>
      </ul>
      
      <p style="margin: 0 0 30px 0; font-size: 16px;">Si vous avez besoin d'aide ou si vous avez des questions, n'hésitez pas à nous contacter.</p>
    </div>

    <!-- Footer -->
    <div style="background-color: #f9f9f9; padding: 20px 30px; border-top: 1px solid #e0e0e0; font-size: 14px; color: #666;">
      <p style="margin: 0 0 10px 0;">Cordialement,</p>
      <p style="margin: 0 0 20px 0;"><strong>L'équipe SkillBridge</strong></p>
      <p style="margin: 0; color: #999; font-size: 12px;">Cet email est un message transactionnel. Merci de ne pas répondre directement à cet email.</p>
    </div>
  </div>
</body>
</html>`;

      await emailService.sendEmail({
        to: user.email,
        subject: 'Bienvenue sur SkillBridge - Votre compte est actif',
        text: plainText,
        html: htmlContent,
      });
    } catch (emailError) {
      console.error('[EMAIL DEBUG] Email sending failed:', emailError.message);
    }

    return res.status(201).json({
      success: true,
      message: 'Inscription réussie',
      data: { user: sanitizeUser(user), token: signToken(user) },
    });
  } catch (error) {
    if (user?._id) await User.deleteOne({ _id: user._id });
    if (error.code === 11000) return next(createError(409, 'Cette adresse email est déjà utilisée'));
    return next(error);
  }
};

const login = async (req, res, next) => {
  try {
    const email = typeof req.body?.email === 'string' ? req.body.email.toLowerCase().trim() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';

    if (!email || !password) {
      return next(createError(400, 'Email et mot de passe requis'));
    }

    const user = await User.findOne({ email }).select('+password');

    if (!user) {
      return next(createError(401, 'Email ou mot de passe incorrect'));
    }

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return next(createError(401, 'Email ou mot de passe incorrect'));
    }

    if (user.status !== 'active') {
      return next(createError(403, 'Compte inactif ou suspendu'));
    }

    user.lastLoginAt = new Date();
    await user.save();

    const sanitizedUser = sanitizeUser(user);

    return res.status(200).json({
      success: true,
      message: 'Connexion réussie',
      data: {
        user: sanitizedUser,
        token: signToken(user),
      },
    });
  } catch (error) {
    return next(error);
  }
};

const me = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.userId || req.user.id);
    if (!user) return next(createError(404, 'Utilisateur introuvable'));
    return res.status(200).json({ success: true, data: sanitizeUser(user) });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  register,
  login,
  me,
};
