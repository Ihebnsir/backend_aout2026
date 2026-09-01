const logMiddleware = (req, res, next) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const statusCode = res.statusCode;
    const message = `${req.method} ${req.originalUrl} ${statusCode} ${duration}ms`;

    if (statusCode >= 500) {
      console.error(`[ERROR] ${message}`);
    } else if (statusCode >= 400) {
      console.warn(`[WARN] ${message}`);
    } else {
      console.info(`[INFO] ${message}`);
    }
  });

  next();
};

module.exports = logMiddleware;
