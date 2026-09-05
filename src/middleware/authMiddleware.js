const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const createError = require('http-errors');
const User = require('../models/User');

const getJwtSecret = () => process.env.JWT_SECRET;

const authenticate = async (req, res, next) => {
  const jwtSecret = getJwtSecret();
  if (!jwtSecret) {
    return next(createError(503, 'Service d\'authentification indisponible'));
  }

  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(createError(401, 'Authentification requise'));
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, jwtSecret);
    const userId = decoded.userId || decoded.id;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return next(createError(401, 'Token invalide ou expiré'));
    }

    const user = await User.findById(userId).select('_id role email status').lean();
    if (!user || user.status !== 'active' || user.role !== decoded.role) {
      return next(createError(401, 'Token invalide ou expiré'));
    }

    req.user = {
      id: user._id,
      userId: user._id,
      role: user.role,
      email: user.email,
    };
    return next();
  } catch (error) {
    return next(createError(401, 'Token invalide ou expiré'));
  }
};

module.exports = {
  authenticate,
  getJwtSecret,
};
