const messagingService = require('../services/messagingService');

const send = (promise, res, next, status = 200) => promise
  .then((data) => res.status(status).json({ success: true, data }))
  .catch(next);

const listConversations = (req, res, next) => send(
  messagingService.listConversations(req.user, req.query), res, next
);

const getConversation = (req, res, next) => send(
  messagingService.getConversation(req.params.id, req.user, req.query), res, next
);

const createDirectConversation = (req, res, next) => send(
  messagingService.createDirectConversation(req.user.id, req.body), res, next, 201
);

const createSupportConversation = (req, res, next) => send(
  messagingService.createSupportConversation(req.user.id, req.body), res, next, 201
);

const sendMessage = (req, res, next) => send(
  messagingService.sendMessage(
    req.params.id,
    req.user,
    req.body.content,
    req.body.clientMessageId
  ),
  res,
  next,
  201
);

const updateStatus = (req, res, next) => send(
  messagingService.updateSupportStatus(req.params.id, req.body.status, req.user), res, next
);

const markRead = (req, res, next) => send(
  messagingService.markRead(req.params.id, req.user), res, next
);

module.exports = {
  listConversations,
  getConversation,
  createDirectConversation,
  createSupportConversation,
  sendMessage,
  updateStatus,
  markRead,
};
