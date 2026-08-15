const jwt = require('jsonwebtoken');
const createError = require('http-errors');
const User = require('../models/User');
const { JWT_SECRET } = require('../middleware/authMiddleware');

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
      return next(createError(403, 'Compte désactivé ou suspendu'));
    }

    const token = jwt.sign(
      {
        id: user._id,
        role: user.role,
        email: user.email,
      },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    const sanitizedUser = user.toObject ? user.toObject() : { ...user };
    delete sanitizedUser.password;
    delete sanitizedUser.__v;

    return res.status(200).json({
      success: true,
      message: 'Connexion réussie',
      data: {
        user: sanitizedUser,
        token,
      },
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  login,
};
