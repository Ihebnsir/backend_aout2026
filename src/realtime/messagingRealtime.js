const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/User');
const messagingService = require('../services/messagingService');
const { getJwtSecret } = require('../middleware/authMiddleware');

const getToken = (socket) => {
  const authToken = socket.handshake.auth?.token;
  const header = socket.handshake.headers?.authorization;
  if (typeof authToken === 'string') return authToken.replace(/^Bearer\s+/i, '');
  if (typeof header === 'string' && header.startsWith('Bearer ')) return header.slice(7);
  return null;
};

const setupMessagingRealtime = (httpServer, corsOrigin) => {
  const io = new Server(httpServer, {
    cors: {
      origin: corsOrigin,
      credentials: true,
    },
  });

  io.use(async (socket, next) => {
    const jwtSecret = getJwtSecret();
    const token = getToken(socket);
    if (!jwtSecret || !token) return next(new Error('Authentification requise'));

    try {
      const decoded = jwt.verify(token, jwtSecret);
      const userId = decoded.userId || decoded.id;
      if (!mongoose.Types.ObjectId.isValid(userId)) return next(new Error('Token invalide'));
      const user = await User.findOne({ _id: userId, role: decoded.role, status: 'active' })
        .select('_id role email')
        .lean();
      if (!user) return next(new Error('Token invalide'));
      socket.user = { id: user._id, role: user.role, email: user.email };
      return next();
    } catch (error) {
      return next(new Error('Token invalide'));
    }
  });

  io.on('connection', (socket) => {
    socket.on('conversation:join', async (conversationId, acknowledge) => {
      const reply = typeof acknowledge === 'function' ? acknowledge : () => {};
      if (!mongoose.Types.ObjectId.isValid(conversationId)) return reply({ success: false, message: 'ID conversation invalide' });
      const allowed = await messagingService.canAccessConversation(conversationId, socket.user);
      if (!allowed) return reply({ success: false, message: 'Accès interdit' });
      socket.join(`conversation:${conversationId}`);
      return reply({ success: true });
    });

    socket.on('conversation:leave', (conversationId) => {
      if (mongoose.Types.ObjectId.isValid(conversationId)) {
        socket.leave(`conversation:${conversationId}`);
      }
    });
  });

  messagingService.setMessageEmitter((conversation, message) => {
    io.to(`conversation:${conversation._id}`).emit('message:new', {
      conversationId: conversation._id,
      message: message.toObject ? message.toObject() : message,
    });
  });

  return io;
};

module.exports = setupMessagingRealtime;
