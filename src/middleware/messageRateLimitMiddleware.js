const createError = require('http-errors');

const buckets = new Map();
const windowMs = Number(process.env.MESSAGE_RATE_LIMIT_WINDOW_MS) || 60_000;
const maxRequests = Number(process.env.MESSAGE_RATE_LIMIT_MAX) || 30;

const messageRateLimit = (req, res, next) => {
  const userId = req.user?.id?.toString() || req.ip;
  const now = Date.now();
  const current = buckets.get(userId);

  if (!current || now - current.startedAt >= windowMs) {
    buckets.set(userId, { startedAt: now, count: 1 });
    return next();
  }

  if (current.count >= maxRequests) {
    return next(createError(429, 'Trop de messages envoyés, veuillez réessayer plus tard'));
  }

  current.count += 1;
  return next();
};

module.exports = messageRateLimit;
