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
var errorMiddleware = require('./src/middleware/errorMiddleware');

var app = express();

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);
app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/centres', centreRouter);

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