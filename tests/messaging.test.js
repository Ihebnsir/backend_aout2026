const http = require('http');
const fs = require('fs');
const path = require('path');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { io: createSocket } = require('socket.io-client');
const { expect } = require('chai');
const app = require('../app');
const setupMessagingRealtime = require('../src/realtime/messagingRealtime');
const User = require('../src/models/User');
const Centre = require('../src/models/Centre');
const Formation = require('../src/models/Formation');
const Conversation = require('../src/models/Conversation');
const Message = require('../src/models/Message');
const Notification = require('../src/models/Notification');
const { connectTestDatabase } = require('./testDatabase');

let learner;
let otherLearner;
let centreUser;
let otherCentreUser;
let admin;
let centre;
let otherCentre;
let formation;
let otherFormation;
let learnerToken;
let otherLearnerToken;
let centreToken;
let otherCentreToken;
let adminToken;
let server;
let io;

const sign = (user) => jwt.sign(
  { id: user._id, role: user.role, email: user.email },
  process.env.JWT_SECRET,
  { expiresIn: '1h' }
);

const insertFormation = async (centreId, title) => {
  const id = new mongoose.Types.ObjectId();
  await Formation.collection.insertOne({
    _id: id,
    centre: centreId,
    title,
    description: 'Formation de test',
    price: 100,
    duration: '1 jour',
    status: 'confirmed',
    offreStage: false,
    entreprisesPartenaires: [],
    sessions: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return Formation.findById(id);
};

const createDirect = (token, body = { centreId: centre._id.toString(), formationId: formation._id.toString() }) => request(app)
  .post('/api/conversations/direct')
  .set('Authorization', `Bearer ${token}`)
  .send(body);

const uploadAttachment = (token, conversationId, fileBuffer, filename, contentType) => request(app)
  .post(`/api/conversations/${conversationId}/attachments`)
  .set('Authorization', `Bearer ${token}`)
  .attach('file', fileBuffer, { filename, contentType });

describe('Standalone messaging API', function () {
  this.timeout(15000);

  before(async function () {
    this.timeout(30000);
    process.env.ATTACHMENT_STORAGE_DIR = path.join(__dirname, '../.tmp-attachment-tests');
    process.env.MAX_ATTACHMENT_SIZE = '1048576';
    process.env.MAX_ATTACHMENTS_PER_MESSAGE = '3';
    await connectTestDatabase();

    [learner, otherLearner, centreUser, otherCentreUser, admin] = await User.create([
      { nom: 'Message', prenom: 'Learner', email: 'message.learner@test.com', password: 'Password123!', telephone: '0600000300', role: 'apprenant', status: 'active' },
      { nom: 'Other', prenom: 'Learner', email: 'message.other@test.com', password: 'Password123!', telephone: '0600000301', role: 'apprenant', status: 'active' },
      { nom: 'Message', prenom: 'Centre', email: 'message.centre@test.com', password: 'Password123!', telephone: '0600000302', role: 'centre', status: 'active' },
      { nom: 'Other', prenom: 'Centre', email: 'message.other.centre@test.com', password: 'Password123!', telephone: '0600000303', role: 'centre', status: 'active' },
      { nom: 'Message', prenom: 'Admin', email: 'message.admin@test.com', password: 'Password123!', telephone: '0600000304', role: 'admin', status: 'active' },
    ]);

    [centre, otherCentre] = await Centre.create([
      { userId: centreUser._id, name: 'Message Centre', email: 'centre@test.com' },
      { userId: otherCentreUser._id, name: 'Other Centre', email: 'other.centre@test.com' },
    ]);

    formation = await insertFormation(centre._id, 'Message formation');
    otherFormation = await insertFormation(otherCentre._id, 'Other formation');
    learnerToken = sign(learner);
    otherLearnerToken = sign(otherLearner);
    centreToken = sign(centreUser);
    otherCentreToken = sign(otherCentreUser);
    adminToken = sign(admin);

    server = http.createServer(app);
    io = setupMessagingRealtime(server, 'http://localhost:3000');
    await new Promise((resolve) => server.listen(0, resolve));
  });

  beforeEach(async () => {
    await Promise.all([
      Message.deleteMany({}),
      Conversation.deleteMany({}),
      Notification.deleteMany({}),
    ]);
  });

  after(async function () {
    if (io) io.close();
    if (server) await new Promise((resolve) => server.close(resolve));
  });

  it('requires authentication for conversation listing and creation', async () => {
    expect((await request(app).get('/api/conversations')).status).to.equal(401);
    expect((await request(app).post('/api/conversations/direct').send({ centreId: centre._id })).status).to.equal(401);
  });

  it('creates and deduplicates a formation-linked direct conversation', async () => {
    const first = await createDirect(learnerToken);
    const second = await createDirect(learnerToken);

    expect(first.status).to.equal(201);
    expect(second.status).to.equal(201);
    expect(first.body.data.conversation._id).to.equal(second.body.data.conversation._id);
    expect(await Conversation.countDocuments({ type: 'direct' })).to.equal(1);
  });

  it('validates centre and formation ownership', async () => {
    expect((await createDirect(learnerToken, { centreId: new mongoose.Types.ObjectId() })).status).to.equal(404);
    expect((await createDirect(learnerToken, { centreId: centre._id, formationId: otherFormation._id })).status).to.equal(400);

    await User.updateOne({ _id: centreUser._id }, { status: 'inactive' });
    expect((await createDirect(learnerToken)).status).to.equal(403);
    await User.updateOne({ _id: centreUser._id }, { status: 'active' });
    expect((await createDirect(centreToken)).status).to.equal(403);
  });

  it('enforces participant authorization for learners and centres', async () => {
    const created = await createDirect(learnerToken);
    const conversationId = created.body.data.conversation._id;

    expect((await request(app).get(`/api/conversations/${conversationId}`).set('Authorization', `Bearer ${otherLearnerToken}`)).status).to.equal(404);
    expect((await request(app).get(`/api/conversations/${conversationId}`).set('Authorization', `Bearer ${otherCentreToken}`)).status).to.equal(404);
    expect((await request(app).get(`/api/conversations/${conversationId}`).set('Authorization', `Bearer ${centreToken}`)).status).to.equal(200);
    expect((await request(app).get('/api/conversations').set('Authorization', `Bearer ${adminToken}`)).body.data.data).to.have.length(0);
  });

  it('derives sender identity and makes message retries idempotent', async () => {
    const created = await createDirect(learnerToken);
    const conversationId = created.body.data.conversation._id;
    const clientMessageId = 'message-retry-1';
    const forgedConversationId = new mongoose.Types.ObjectId().toString();

    const first = await request(app)
      .post(`/api/conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${learnerToken}`)
      .send({
        content: 'Bonjour',
        senderId: otherLearner._id,
        senderRole: 'admin',
        conversationId: forgedConversationId,
        clientMessageId,
      });
    const retry = await request(app)
      .post(`/api/conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${learnerToken}`)
      .send({ content: 'Bonjour', senderId: otherLearner._id, senderRole: 'admin', clientMessageId });

    expect(first.status).to.equal(201);
    expect(retry.status).to.equal(201);
    expect(first.body.data.message.senderId._id.toString()).to.equal(learner._id.toString());
    expect(await Message.countDocuments({ conversationId })).to.equal(1);
    const learnerNotification = await Notification.findOne({ category: 'messages' });
    expect(learnerNotification).to.not.equal(null);
    expect(learnerNotification.conversationId.toString()).to.equal(conversationId.toString());
    expect(learnerNotification.conversationId.toString()).to.not.equal(forgedConversationId);
    expect(learnerNotification.role).to.equal('centre');
    expect(await Notification.countDocuments({ category: 'messages' })).to.equal(1);

    const otherSender = await request(app)
      .post(`/api/conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${centreToken}`)
      .send({ content: 'Usurpation de clé', clientMessageId });
    expect(otherSender.status).to.equal(409);
  });

  it('supports learner support conversations and admin status updates', async () => {
    const created = await request(app)
      .post('/api/conversations/support')
      .set('Authorization', `Bearer ${learnerToken}`)
      .send({ subject: 'Aide', initialMessage: 'Besoin d aide' });
    const conversationId = created.body.data.conversation._id;

    expect(created.status).to.equal(201);
    expect((await Notification.findOne({ role: 'admin', category: 'messages' })).conversationId.toString())
      .to.equal(conversationId.toString());
    expect((await request(app).get('/api/conversations').set('Authorization', `Bearer ${adminToken}`)).body.data.data).to.have.length(1);
    expect((await request(app).patch(`/api/conversations/${conversationId}/status`).set('Authorization', `Bearer ${adminToken}`).send({ status: 'resolved' })).status).to.equal(200);
    expect((await request(app).patch(`/api/conversations/${conversationId}/status`).set('Authorization', `Bearer ${learnerToken}`).send({ status: 'closed' })).status).to.equal(403);

    const reply = await request(app)
      .post(`/api/conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ content: 'Réponse support' });
    expect(reply.status).to.equal(201);
    const learnerNotification = await Notification.findOne({ role: 'apprenant', category: 'messages' });
    expect(learnerNotification.conversationId.toString()).to.equal(conversationId.toString());
    expect(await Notification.countDocuments({ role: 'apprenant', category: 'messages' })).to.equal(1);
  });

  it('adds the conversation id to notifications in both direct message directions', async () => {
    const created = await createDirect(learnerToken);
    const conversationId = created.body.data.conversation._id;

    await request(app)
      .post(`/api/conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${learnerToken}`)
      .send({ content: 'Learner notification', clientMessageId: 'notification-learner-1' });

    const centreNotification = await Notification.findOne({ role: 'centre', category: 'messages' });
    expect(centreNotification.conversationId.toString()).to.equal(conversationId.toString());

    await request(app)
      .post(`/api/conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${centreToken}`)
      .send({ content: 'Centre notification', clientMessageId: 'notification-centre-1' });

    const learnerNotification = await Notification.findOne({ role: 'apprenant', category: 'messages' });
    expect(learnerNotification.conversationId.toString()).to.equal(conversationId.toString());
    expect((await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${centreToken}`)).body.data[0].conversationId.toString())
      .to.equal(conversationId.toString());
  });

  it('keeps unread state user-specific and supports mark-as-read', async () => {
    const created = await createDirect(learnerToken);
    const conversationId = created.body.data.conversation._id;
    await request(app).post(`/api/conversations/${conversationId}/messages`).set('Authorization', `Bearer ${learnerToken}`).send({ content: 'Unread test' });

    const centreView = await request(app).get(`/api/conversations/${conversationId}`).set('Authorization', `Bearer ${centreToken}`);
    expect(centreView.body.data.conversation.unreadCount).to.equal(1);
    expect((await request(app).patch(`/api/conversations/${conversationId}/read`).set('Authorization', `Bearer ${centreToken}`)).status).to.equal(200);
    expect((await request(app).get(`/api/conversations/${conversationId}`).set('Authorization', `Bearer ${centreToken}`)).body.data.conversation.unreadCount).to.equal(0);
  });

  it('rejects invalid messages and prevents unauthorized socket room joins', async () => {
    const created = await createDirect(learnerToken);
    const conversationId = created.body.data.conversation._id;
    expect((await request(app).post(`/api/conversations/${conversationId}/messages`).set('Authorization', `Bearer ${learnerToken}`).send({ content: ' ' })).status).to.equal(400);

    const socket = createSocket(`http://localhost:${server.address().port}`, { auth: { token: otherLearnerToken }, transports: ['websocket'] });
    await new Promise((resolve, reject) => {
      socket.on('connect_error', reject);
      socket.on('connect', () => socket.emit('conversation:join', conversationId, (result) => {
        expect(result.success).to.equal(false);
        socket.close();
        resolve();
      }));
    });
  });

  it('emits new messages only after an authorized socket joins', async () => {
    const created = await createDirect(learnerToken);
    const conversationId = created.body.data.conversation._id;
    const socket = createSocket(`http://localhost:${server.address().port}`, { auth: { token: centreToken }, transports: ['websocket'] });

    await new Promise((resolve, reject) => {
      socket.on('connect_error', reject);
      socket.on('connect', () => socket.emit('conversation:join', conversationId, (result) => {
        if (!result.success) return reject(new Error(result.message));
        socket.once('message:new', (event) => {
          expect(event.conversationId.toString()).to.equal(conversationId.toString());
          expect(event.message.content).to.equal('Realtime');
          socket.close();
          resolve();
        });
        request(app).post(`/api/conversations/${conversationId}/messages`).set('Authorization', `Bearer ${learnerToken}`).send({ content: 'Realtime' }).then((response) => {
          if (response.status !== 201) reject(new Error(`message request returned ${response.status}`));
        }).catch(reject);
      }));
    });
  });

  it('uploads a valid PDF and stores metadata without exposing the file publicly', async () => {
    const created = await createDirect(learnerToken);
    const conversationId = created.body.data.conversation._id;
    const pdfBuffer = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF', 'utf8');

    const upload = await uploadAttachment(learnerToken, conversationId, pdfBuffer, 'report.pdf', 'application/pdf');
    expect(upload.status).to.equal(201);
    expect(upload.body.data.attachment).to.include.keys(['id', 'originalName', 'storedName', 'mimeType', 'size', 'url']);
    expect(upload.body.data.attachment.mimeType).to.equal('application/pdf');
    expect(upload.body.data.attachment.originalName).to.equal('report.pdf');
    expect(upload.body.data.attachment.url).to.contain(`/api/conversations/${conversationId}/attachments/`);
    expect(upload.body.data.attachment.storedName).to.not.include('report.pdf');

    const attachmentPath = path.join(process.env.ATTACHMENT_STORAGE_DIR, 'conversations', conversationId.toString(), learner._id.toString(), upload.body.data.attachment.storedName);
    expect(fs.existsSync(attachmentPath)).to.equal(true);
    expect(fs.existsSync(path.join(__dirname, '../public', upload.body.data.attachment.storedName))).to.equal(false);

    const download = await request(app)
      .get(`/api/conversations/${conversationId}/attachments/${upload.body.data.attachment.id}`)
      .set('Authorization', `Bearer ${learnerToken}`);
    expect(download.status).to.equal(200);
    expect(download.headers['content-type']).to.match(/pdf|application/);
  });

  it('validates upload authorization, file type, size, and traversal protection', async () => {
    const created = await createDirect(learnerToken);
    const conversationId = created.body.data.conversation._id;
    const validBuffer = Buffer.from('hello world', 'utf8');

    expect((await request(app)
      .post(`/api/conversations/${conversationId}/attachments`)
      .attach('file', validBuffer, { filename: 'test.png', contentType: 'image/png' })).status).to.equal(401);

    expect((await uploadAttachment(otherLearnerToken, conversationId, validBuffer, 'other.png', 'image/png')).status).to.equal(403);

    expect((await uploadAttachment(learnerToken, conversationId, validBuffer, 'bad.exe', 'application/x-msdownload')).status).to.equal(400);

    const tooLarge = Buffer.alloc(2 * 1024 * 1024, 'x');
    expect((await uploadAttachment(learnerToken, conversationId, tooLarge, 'oversized.pdf', 'application/pdf')).status).to.equal(400);

    const traversal = await uploadAttachment(learnerToken, conversationId, validBuffer, '../dangerous.pdf', 'application/pdf');
    expect(traversal.status).to.equal(201);
    expect(traversal.body.data.attachment.originalName).to.equal('dangerous.pdf');
    expect(traversal.body.data.attachment.storedName).to.not.include('..');
  });

  it('allows text, attachment-only, and combined messages while rejecting empty content', async () => {
    const created = await createDirect(learnerToken);
    const conversationId = created.body.data.conversation._id;
    const upload = await uploadAttachment(learnerToken, conversationId, Buffer.from('hello pdf', 'utf8'), 'note.pdf', 'application/pdf');
    const attachmentMeta = upload.body.data.attachment;

    const textOnly = await request(app)
      .post(`/api/conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${learnerToken}`)
      .send({ content: 'Texte simple' });
    expect(textOnly.status).to.equal(201);

    const attachmentOnly = await request(app)
      .post(`/api/conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${learnerToken}`)
      .send({ attachments: [attachmentMeta] });
    expect(attachmentOnly.status).to.equal(201);
    expect(attachmentOnly.body.data.message.attachments).to.have.length(1);

    const textAndAttachment = await request(app)
      .post(`/api/conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${learnerToken}`)
      .send({ content: 'Document joint', attachments: [attachmentMeta] });
    expect(textAndAttachment.status).to.equal(201);
    expect(textAndAttachment.body.data.message.attachments[0].id).to.equal(attachmentMeta.id);

    const forbiddenEmpty = await request(app)
      .post(`/api/conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${learnerToken}`)
      .send({ content: '   ', attachments: [] });
    expect(forbiddenEmpty.status).to.equal(400);
  });

  it('keeps attachment metadata in real-time events and notification payloads', async () => {
    const created = await createDirect(learnerToken);
    const conversationId = created.body.data.conversation._id;
    const upload = await uploadAttachment(learnerToken, conversationId, Buffer.from('x', 'utf8'), 'photo.png', 'image/png');
    const attachment = upload.body.data.attachment;
    const socket = createSocket(`http://localhost:${server.address().port}`, { auth: { token: centreToken }, transports: ['websocket'] });

    await new Promise((resolve, reject) => {
      socket.on('connect_error', reject);
      socket.on('connect', () => {
        socket.emit('conversation:join', conversationId, async (result) => {
          if (!result.success) return reject(new Error(result.message));
          socket.once('message:new', (event) => {
            expect(event.conversationId.toString()).to.equal(conversationId.toString());
            expect(event.message.attachments).to.have.length(1);
            expect(event.message.attachments[0].id).to.equal(attachment.id);
            socket.close();
            resolve();
          });

          try {
            const response = await request(app)
              .post(`/api/conversations/${conversationId}/messages`)
              .set('Authorization', `Bearer ${learnerToken}`)
              .send({ content: 'Image envoyée', attachments: [attachment] });
            expect(response.status).to.equal(201);
          } catch (error) {
            reject(error);
          }
        });
      });
    });

    const notification = await Notification.findOne({ role: 'centre', category: 'messages' }).lean();
    expect(notification.conversationId.toString()).to.equal(conversationId.toString());
  });

  it('rejects download access from unrelated users and mismatched conversation metadata', async () => {
    const created = await createDirect(learnerToken);
    const conversationId = created.body.data.conversation._id;
    const upload = await uploadAttachment(learnerToken, conversationId, Buffer.from('secure', 'utf8'), 'secure.txt', 'text/plain');

    expect((await request(app)
      .get(`/api/conversations/${conversationId}/attachments/${upload.body.data.attachment.id}`)
      .set('Authorization', `Bearer ${otherLearnerToken}`)).status).to.equal(404);

    const forged = await request(app)
      .get(`/api/conversations/${new mongoose.Types.ObjectId()}/attachments/${upload.body.data.attachment.id}`)
      .set('Authorization', `Bearer ${learnerToken}`);
    expect(forged.status).to.equal(404);

    const tampered = await request(app)
      .get(`/api/conversations/${conversationId}/attachments/${new mongoose.Types.ObjectId()}`)
      .set('Authorization', `Bearer ${learnerToken}`);
    expect(tampered.status).to.equal(404);
  });

  it('preserves message idempotency and blocks reassignment to another conversation', async () => {
    const created = await createDirect(learnerToken);
    const conversationId = created.body.data.conversation._id;
    const upload = await uploadAttachment(learnerToken, conversationId, Buffer.from('idempotent', 'utf8'), 'idempotent.pdf', 'application/pdf');

    const first = await request(app)
      .post(`/api/conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${learnerToken}`)
      .send({ content: 'Retry', clientMessageId: 'attach-retry', attachments: [upload.body.data.attachment] });
    expect(first.status).to.equal(201);

    const second = await request(app)
      .post(`/api/conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${learnerToken}`)
      .send({ content: 'Retry', clientMessageId: 'attach-retry', attachments: [upload.body.data.attachment] });
    expect(second.status).to.equal(201);
    expect(await Message.countDocuments({ conversationId })).to.equal(1);

    const otherConversation = await createDirect(otherLearnerToken);
    const forged = await request(app)
      .post(`/api/conversations/${otherConversation.body.data.conversation._id}/messages`)
      .set('Authorization', `Bearer ${otherLearnerToken}`)
      .send({ content: 'Wrong conversation', attachments: [upload.body.data.attachment] });
    expect(forged.status).to.equal(400);
  });

  it('applies the focused message rate limit', async () => {
    const created = await createDirect(otherLearnerToken);
    const conversationId = created.body.data.conversation._id;
    let lastResponse;
    for (let index = 0; index < 31; index += 1) {
      lastResponse = await request(app)
        .post(`/api/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${otherLearnerToken}`)
        .send({ content: `Rate limit ${index}`, clientMessageId: `rate-${index}` });
    }
    expect(lastResponse.status).to.equal(429);
  });
});
