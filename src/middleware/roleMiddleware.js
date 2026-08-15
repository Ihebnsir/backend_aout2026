const createError = require('http-errors');

const requireRole = (...allowedRoles) => (req, res, next) => {
  if (!req.user || !req.user.role) {
    return next(createError(401, 'Authentification requise'));
  }

  if (!allowedRoles.includes(req.user.role)) {
    return next(createError(403, 'Accès interdit'));
  }

  return next();
};

const allowOwnerOrAdmin = (req, res, next) => {
  if (!req.user) {
    return next(createError(401, 'Authentification requise'));
  }

  if (req.user.role === 'admin') {
    return next();
  }

  if (req.params.id && req.user.id && req.user.id.toString() === req.params.id.toString()) {
    return next();
  }

  return next(createError(403, 'Accès interdit'));
};

module.exports = {
  requireRole,
  allowOwnerOrAdmin,
};
