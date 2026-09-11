var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');

require('dotenv').config();
const { connectToMongoDB } = require('./config/mongo.connection');
var indexRouter = require('./routes/index');
var usersRouter = require('./src/routes/userRoutes');
var authRouter = require('./src/routes/authRoutes');
var centreRouter = require('./src/routes/centreRoutes');
var formationRouter = require('./src/routes/formationRoutes');
var reservationRouter = require('./src/routes/reservationRoutes');
var centreDocumentRouter = require('./src/routes/centreDocumentRoutes');
var certificationRouter = require('./src/routes/certificationRoutes');
var sessionRouter = require('./src/routes/sessionRoutes');
var attendanceRouter = require('./src/routes/attendanceRoutes');
var progressRouter = require('./src/routes/progressRoutes');
var trainerRouter = require('./src/routes/trainerRoutes');
var studentRouter = require('./src/routes/studentRoutes');
var analyticsRouter = require('./src/routes/analyticsRoutes');
var noteRouter = require('./src/routes/noteRoutes');
var notificationRouter = require('./src/routes/notificationRoutes');
var signalementRouter = require('./src/routes/signalementRoutes');
var litigeRouter = require('./src/routes/litigeRoutes');
var dashboardRouter = require('./src/routes/dashboardRoutes');
var messagingRouter = require('./src/routes/messagingRoutes');
var attachmentRouter = require('./src/routes/attachmentRoutes');
var errorMiddleware = require('./src/middleware/errorMiddleware');
var logMiddleware = require('./src/middleware/logMiddleware');
var emailService = require('./src/services/emailService');
var setupMessagingRealtime = require('./src/realtime/messagingRealtime');
var { validateStorageConfig } = require('./src/services/attachmentStorage');

var app = express();

const isProduction = process.env.NODE_ENV === 'production';
const corsOrigin = (process.env.CORS_ORIGIN || (isProduction ? '' : 'http://localhost:3000')).trim();
app.use((req, res, next) => {
  const requestOrigin = req.headers.origin;

  if (requestOrigin === corsOrigin) {
    res.setHeader('Access-Control-Allow-Origin', corsOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }

  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }

  return next();
});

app.use(logger('dev'));
app.use(logMiddleware);
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/health', (req, res) => {
  res.json({ success: true });
});

app.use('/', indexRouter);
app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/centres', centreRouter);
app.use('/api/centres', trainerRouter);
app.use('/api/centres', studentRouter);
app.use('/api/formations', formationRouter);
app.use('/api/reservations', reservationRouter);
app.use('/api/centre-documents', centreDocumentRouter);
app.use('/api/certifications', certificationRouter);
app.use('/api/sessions', sessionRouter);
app.use('/api/attendance', attendanceRouter);
app.use('/api/progress', progressRouter);
app.use('/api', analyticsRouter);
app.use('/api/notes', noteRouter);
app.use('/api/notifications', notificationRouter);
app.use('/api/signalements', signalementRouter);
app.use('/api/litiges', litigeRouter);
app.use('/api/admin/dashboard', dashboardRouter);
app.use('/api/conversations', attachmentRouter);
app.use('/api/conversations', messagingRouter);

app.use(function(req, res, next) {
  next(createError(404, 'Route introuvable'));
});

app.use(errorMiddleware);

if (require.main === module) {
  const http = require('http');
  const server = http.createServer(app);
  setupMessagingRealtime(server, corsOrigin);

  const startServer = async () => {
    if (isProduction && !corsOrigin) {
      throw new Error('CORS_ORIGIN is required in production');
    }
    if (isProduction && !process.env.JWT_SECRET?.trim()) {
      throw new Error('JWT_SECRET is required in production');
    }

    validateStorageConfig();
    await connectToMongoDB();

    if (process.env.SMTP_HOST && process.env.SMTP_PORT && process.env.SMTP_USER
      && process.env.SMTP_PASSWORD && process.env.EMAIL_FROM) {
      try {
        await emailService.verifyTransporter();
        console.log('[EMAIL DEBUG] SMTP connection verified');
      } catch (error) {
        console.error('[EMAIL DEBUG] SMTP verification failed:', error.message);
      }
    } else {
      console.error('[EMAIL DEBUG] SMTP verification failed: Configuration SMTP incomplète');
    }

    const port = process.env.PORT || 5000;
    server.listen(port, '0.0.0.0', () => {
      console.log('Server is running on port ' + port);
    });
  };

  startServer().catch((error) => {
    console.error('Server startup failed:', error.message);
    process.exit(1);
  });
}

module.exports = app;