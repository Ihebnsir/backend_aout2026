const request = require('supertest');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { expect } = require('chai');
const app = require('../app');
const User = require('../src/models/User');
const Centre = require('../src/models/Centre');
const Formation = require('../src/models/Formation');
const Reservation = require('../src/models/Reservation');
const Signalement = require('../src/models/Signalement');
const Notification = require('../src/models/Notification');
const Litige = require('../src/models/Litige');
const Message = require('../src/models/Message');
const { connectTestDatabase } = require('./testDatabase');

const sign = (user) => jwt.sign(
  { id: user._id, role: user.role, email: user.email },
  'test-secret-key',
  { expiresIn: '1h' }
);

describe('Signalement API', function () {
  this.timeout(30000);

  let admin;
  let learner;
  let otherLearner;
  let centreUser;
  let centre;
  let otherCentre;
  let formation;
  let otherFormation;
  let adminToken;
  let learnerToken;
  let centreToken;

  const createReport = (reporter = learner, overrides = {}) => Signalement.create({
    reporter: reporter._id,
    type: 'Spam',
    contenu: 'Contenu a verifier',
    cibleType: 'autre',
    ...overrides,
  });

  before(async () => {
    await connectTestDatabase();
    await Promise.all([
      Signalement.deleteMany({}),
      Notification.deleteMany({}),
      Litige.deleteMany({}),
    ]);

    [admin, learner, otherLearner, centreUser] = await User.create([
      { nom: 'Admin', prenom: 'Signalement', email: 'signalement.admin@test.com', password: 'Password123!', role: 'admin', status: 'active' },
      { nom: 'Learner', prenom: 'Signalement', email: 'signalement.learner@test.com', password: 'Password123!', role: 'apprenant', status: 'active' },
      { nom: 'Other', prenom: 'Learner', email: 'signalement.other@test.com', password: 'Password123!', role: 'apprenant', status: 'active' },
      { nom: 'Centre', prenom: 'Owner', email: 'signalement.centre@test.com', password: 'Password123!', role: 'centre', status: 'active' },
    ]);

    [centre, otherCentre] = await Centre.create([
      { userId: centreUser._id, name: 'Signalement Centre' },
      { userId: otherLearner._id, name: 'Other Centre' },
    ]);
    [formation, otherFormation] = await Formation.create([
      { centre: centre._id, title: 'Signalement Formation', price: 100, duration: '1 jour' },
      { centre: otherCentre._id, title: 'Other Formation', price: 100, duration: '1 jour' },
    ]);

    adminToken = sign(admin);
    learnerToken = sign(learner);
    centreToken = sign(centreUser);
  });

  beforeEach(async () => {
    await Promise.all([
      Signalement.deleteMany({}),
      Notification.deleteMany({}),
      Litige.deleteMany({}),
      Reservation.deleteMany({}),
    ]);
  });

  it('allows learner, centre, and admin creation, but rejects unauthenticated creation', async () => {
    for (const [token, expectedReporter] of [[learnerToken, learner], [centreToken, centreUser], [adminToken, admin]]) {
      const response = await request(app)
        .post('/api/signalements')
        .set('Authorization', `Bearer ${token}`)
        .send({ type: 'Spam', contenu: 'Signalement valide' });
      expect(response.status).to.equal(201);
      expect(response.body.data.reporter._id.toString()).to.equal(expectedReporter._id.toString());
    }

    const learnerNotifications = await Notification.find({ role: 'apprenant', userId: learner._id, category: 'signalements' });
    const centreNotifications = await Notification.find({ role: 'centre', userId: centreUser._id, category: 'signalements' });
    expect(learnerNotifications).to.have.length(1);
    expect(centreNotifications).to.have.length(1);
    expect(await Notification.countDocuments({ role: 'admin', category: 'signalements' })).to.equal(2);

    const unauthenticated = await request(app)
      .post('/api/signalements')
      .send({ type: 'Spam', contenu: 'Sans authentification' });
    expect(unauthenticated.status).to.equal(401);
  });

  it('rejects the unsupported commentaire target consistently', async () => {
    const response = await request(app)
      .post('/api/signalements')
      .set('Authorization', `Bearer ${learnerToken}`)
      .send({
        type: 'Spam',
        contenu: 'Commentaire non pris en charge',
        cibleType: 'commentaire',
        cibleId: new mongoose.Types.ObjectId(),
      });

    expect(response.status).to.equal(400);
  });

  it('accepts existing centre and message targets', async () => {
    const centreTarget = await request(app)
      .post('/api/signalements')
      .set('Authorization', `Bearer ${learnerToken}`)
      .send({ type: 'Spam', contenu: 'Centre a verifier', cibleType: 'centre', cibleId: centre._id });
    expect(centreTarget.status).to.equal(201);

    const message = await Message.create({
      conversationId: new mongoose.Types.ObjectId(),
      senderId: learner._id,
      senderRole: 'apprenant',
      content: 'Message a verifier',
    });
    const messageTarget = await request(app)
      .post('/api/signalements')
      .set('Authorization', `Bearer ${learnerToken}`)
      .send({ type: 'Spam', contenu: 'Message a verifier', cibleType: 'message', cibleId: message._id });
    expect(messageTarget.status).to.equal(201);
  });

  it('supports reporter history with ownership, pagination, and filters', async () => {
    await createReport(learner, { type: 'Spam', status: 'En attente' });
    await createReport(learner, { type: 'Fausse information', status: 'Résolu' });
    await createReport(otherLearner, { type: 'Spam' });

    const response = await request(app)
      .get('/api/signalements/mine?type=Spam&page=1&limit=1')
      .set('Authorization', `Bearer ${learnerToken}`);

    expect(response.status).to.equal(200);
    expect(response.body.data).to.have.length(1);
    expect(response.body.data[0].reporter._id.toString()).to.equal(learner._id.toString());
    expect(response.body.pagination.total).to.equal(1);
  });

  it('allows admin list/detail and rejects non-admin list/detail', async () => {
    const report = await createReport();
    const adminList = await request(app)
      .get('/api/signalements')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(adminList.status).to.equal(200);

    const adminDetail = await request(app)
      .get(`/api/signalements/${report._id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(adminDetail.status).to.equal(200);

    const learnerList = await request(app)
      .get('/api/signalements')
      .set('Authorization', `Bearer ${learnerToken}`);
    const learnerDetail = await request(app)
      .get(`/api/signalements/${report._id}`)
      .set('Authorization', `Bearer ${learnerToken}`);
    expect(learnerList.status).to.equal(403);
    expect(learnerDetail.status).to.equal(403);
  });

  it('enforces the status lifecycle and sends one reporter notification per change', async () => {
    const report = await createReport();

    for (const status of ['En cours', 'Résolu']) {
      const response = await request(app)
        .patch(`/api/signalements/${report._id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status });
      expect(response.status).to.equal(200);
    }

    const invalid = await request(app)
      .patch(`/api/signalements/${report._id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'En attente' });
    expect(invalid.status).to.equal(400);

    const notifications = await Notification.find({ role: 'apprenant', userId: learner._id, category: 'signalements' });
    expect(notifications).to.have.length(2);

    const forbidden = await request(app)
      .patch(`/api/signalements/${report._id}/status`)
      .set('Authorization', `Bearer ${learnerToken}`)
      .send({ status: 'En cours' });
    expect(forbidden.status).to.equal(403);
  });

  it('validates escalation relationships, creates a litige, and rejects duplicates', async () => {
    const reservation = await Reservation.create({
      learnerId: learner._id,
      formationId: formation._id,
      centreId: centre._id,
      price: 100,
      status: 'COMPLETED',
    });
    const report = await createReport(learner, {
      type: 'Fausse information',
      cibleType: 'formation',
      cibleId: formation._id,
    });

    const valid = await request(app)
      .patch(`/api/signalements/${report._id}/escalate`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reservationId: reservation._id });
    expect(valid.status).to.equal(201);
    expect(valid.body.data.litige).to.exist;
    expect(await Notification.countDocuments({ role: 'apprenant', userId: learner._id, category: 'signalements' })).to.equal(1);

    const duplicate = await request(app)
      .patch(`/api/signalements/${report._id}/escalate`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reservationId: reservation._id });
    expect(duplicate.status).to.equal(409);
  });

  it('rejects incompatible escalation relationships and invalid learner roles', async () => {
    const otherReservation = await Reservation.create({
      learnerId: otherLearner._id,
      formationId: otherFormation._id,
      centreId: otherCentre._id,
      price: 100,
      status: 'COMPLETED',
    });
    const report = await createReport(learner, { cibleType: 'formation', cibleId: formation._id });

    const nonexistentFormation = await request(app)
      .patch(`/api/signalements/${report._id}/escalate`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ centreId: centre._id, formationId: new mongoose.Types.ObjectId() });
    expect(nonexistentFormation.status).to.equal(404);

    const incompatible = await request(app)
      .patch(`/api/signalements/${report._id}/escalate`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ centreId: otherCentre._id, formationId: formation._id });
    expect(incompatible.status).to.equal(400);

    const badReservation = await request(app)
      .patch(`/api/signalements/${report._id}/escalate`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reservationId: otherReservation._id });
    expect(badReservation.status).to.equal(400);

    const badLearner = await request(app)
      .patch(`/api/signalements/${report._id}/escalate`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ etudiantId: admin._id });
    expect(badLearner.status).to.equal(400);

    const forbidden = await request(app)
      .patch(`/api/signalements/${report._id}/escalate`)
      .set('Authorization', `Bearer ${learnerToken}`)
      .send({});
    expect(forbidden.status).to.equal(403);
  });
});
