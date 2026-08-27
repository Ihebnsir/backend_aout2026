const jwt = require('jsonwebtoken');
const createError = require('http-errors');
const User = require('../models/User');
const centreService = require('../services/centreService');
const { JWT_SECRET } = require('../middleware/authMiddleware');

const sanitizeUser = (user) => {
  const sanitizedUser = user.toObject ? user.toObject() : { ...user };
  delete sanitizedUser.password;
  delete sanitizedUser.__v;
  sanitizedUser.id = user._id.toString();
  return sanitizedUser;
};

const signToken = (user) => jwt.sign(
  {
    userId: user._id,
    id: user._id,
    role: user.role,
    email: user.email,
  },
  JWT_SECRET,
  { expiresIn: '1h' }
);

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
