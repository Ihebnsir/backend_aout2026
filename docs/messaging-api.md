# Standalone Messaging API

Standalone messaging is separate from Litige conversations and chatbot/n8n flows.

## Authentication

HTTP endpoints require `Authorization: Bearer <JWT>`. Socket.IO clients use `auth.token` or the Authorization handshake header. The server derives the user and role from the JWT.

## HTTP endpoints

- `GET /api/conversations?page=1&limit=20&search=&type=&status=&formationId=` lists only accessible conversations.
- `GET /api/conversations/:id?page=1&limit=50` returns metadata and chronological messages.
- `POST /api/conversations/direct` with `{ "centreId": "...", "formationId": "...", "initialMessage": "..." }` creates or reuses a direct learner-centre conversation.
- `POST /api/conversations/support` with `{ "subject": "...", "initialMessage": "..." }` creates or reuses an open learner support conversation.
- `POST /api/conversations/:id/messages` with `{ "content": "...", "clientMessageId": "..." }` creates an idempotent message.
- `PATCH /api/conversations/:id/status` with `{ "status": "open|pending|resolved|closed" }` is admin-only and support-only.
- `PATCH /api/conversations/:id/read` marks only the current user's unread count as zero.

All list endpoints cap `limit` at 100. Messages are ordered by `createdAt`, then `_id`.

## Authorization

Learners access conversations where `learnerUserId` is their JWT user. Centres access direct conversations where `centreUserId` is their JWT user. Admins access support conversations only. Client-provided sender and participant identities are ignored or rejected.

A formation-linked direct conversation requires the formation to belong to the selected centre. Centre account and learner accounts must be active.

## Responses and errors

Successful responses use `{ success: true, data: ... }`. Validation errors return `400`; missing authentication returns `401`; unauthorized access returns `403`; missing resources return `404`; duplicate message keys return the existing message; closed support conversations return `409`; message rate limits return `429`.

## Notifications

New direct messages notify the other participant. Learner support messages notify admins. Admin support replies notify the learner. Notifications use the existing `messages` category and are emitted only for newly inserted messages.

## Realtime

When the server is started normally, Socket.IO uses the configured `CORS_ORIGIN`.

Events:

- Client emits `conversation:join` with a conversation ID and acknowledgement callback.
- Client emits `conversation:leave` with a conversation ID.
- Server emits `message:new` to `conversation:<conversationId>` after an API message is persisted.

Room membership is checked against the authenticated user. Clients cannot join arbitrary conversation rooms. Socket.IO does not create messages independently; HTTP message creation remains the write path.

## Rate limiting

Message creation uses `MESSAGE_RATE_LIMIT_WINDOW_MS` and `MESSAGE_RATE_LIMIT_MAX`, defaulting to 60 seconds and 30 requests per authenticated user.
