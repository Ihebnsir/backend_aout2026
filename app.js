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
var noteRouter = require('./src/routes/noteRoutes');
var notificationRouter = require('./src/routes/notificationRoutes');
var signalementRouter = require('./src/routes/signalementRoutes');
var litigeRouter = require('./src/routes/litigeRoutes');
var dashboardRouter = require('./src/routes/dashboardRoutes');
var errorMiddleware = require('./src/middleware/errorMiddleware');
var logMiddleware = require('./src/middleware/logMiddleware');

var app = express();

app.use(logger('dev'));
app.use(logMiddleware);
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);
app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/centres', centreRouter);
app.use('/api/formations', formationRouter);
app.use('/api/reservations', reservationRouter);
app.use('/api/centre-documents', centreDocumentRouter);
app.use('/api/certifications', certificationRouter);
app.use('/api/notes', noteRouter);
app.use('/api/notifications', notificationRouter);
app.use('/api/signalements', signalementRouter);
app.use('/api/litiges', litigeRouter);
app.use('/api/admin/dashboard', dashboardRouter);

app.use(function(req, res, next) {
  next(createError(404, 'Route introuvable'));
});

app.use(errorMiddleware);

if (require.main === module) {
  const http = require('http');
  const server = http.createServer(app);

  const startServer = async () => {
    await connectToMongoDB();

    server.listen(process.env.point || 5000, () => {
      console.log('Server is running on port ' + (process.env.point || 5000));
    });
  };

  startServer();
}

module.exports = app;