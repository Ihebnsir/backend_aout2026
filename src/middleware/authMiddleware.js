const jwt = require('jsonwebtoken');
const createError = require('http-errors');

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key';

const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(createError(401, 'Authentification requise'));
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = {
      id: decoded.userId || decoded.id,
      userId: decoded.userId || decoded.id,
      role: decoded.role,
      email: decoded.email,
    };
    return next();
  } catch (error) {
    return next(createError(401, 'Token invalide ou expiré'));
  }
};

module.exports = {
  authenticate,
  JWT_SECRET,
};
