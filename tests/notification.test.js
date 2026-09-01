const request = require('supertest');
const jwt = require('jsonwebtoken');
const { expect } = require('chai');
const app = require('../app');
const User = require('../src/models/User');
const Notification = require('../src/models/Notification');
const { connectTestDatabase, disconnectTestDatabase } = require('./testDatabase');

let adminToken;
let learnerToken;
let intruderToken;
let learnerId;
let otherUserId;
let learnerNotificationId;
let adminNotificationId;

before(async function () {
  this.timeout(30000);

  await connectTestDatabase();

  await Notification.deleteMany({});

  const admin = await User.create({
    nom: 'Admin',
    prenom: 'Test',
    email: 'admin.notify@test.com',
    password: 'Password123!',
    telephone: '0600000000',
    role: 'admin',
    status: 'active',
  });

  const learner = await User.create({
    nom: 'Apprenant',
    prenom: 'Test',
    email: 'learner.notify@test.com',
    password: 'Password123!',
    telephone: '0600000001',
    role: 'apprenant',
    status: 'active',
  });

  const intruder = await User.create({
    nom: 'Intrus',
    prenom: 'Test',
    email: 'intruder.notify@test.com',
    password: 'Password123!',
    telephone: '0600000002',
    role: 'apprenant',
    status: 'active',
  });

  adminToken = jwt.sign({ id: admin._id, role: admin.role, email: admin.email }, 'test-secret-key', { expiresIn: '1h' });
  learnerToken = jwt.sign({ id: learner._id, role: learner.role, email: learner.email }, 'test-secret-key', { expiresIn: '1h' });
  intruderToken = jwt.sign({ id: intruder._id, role: intruder.role, email: intruder.email }, 'test-secret-key', { expiresIn: '1h' });

  learnerId = learner._id;
  otherUserId = intruder._id;

  const [adminNotif, learnerNotif] = await Promise.all([
    Notification.create({
      role: 'admin',
      userId: null,
      title: 'Admin notice',
      message: 'Admin notification',
      category: 'users',
      lu: false,
    }),
    Notification.create({
      role: 'apprenant',
      userId: learner._id,
      title: 'Welcome learner',
      message: 'Welcome to the platform',
      category: 'reservations',
      lu: false,
    }),
  ]);

  adminNotificationId = adminNotif._id.toString();
  learnerNotificationId = learnerNotif._id.toString();
});

beforeEach(async function () {
  await Notification.deleteMany({});

  const adminNotif = await Notification.create({
    role: 'admin',
    userId: null,
    title: 'Admin notice',
    message: 'Admin notification',
    category: 'users',
    lu: false,
  });

  const learnerNotif = await Notification.create({
    role: 'apprenant',
    userId: learnerId,
    title: 'Welcome learner',
    message: 'Welcome to the platform',
    category: 'reservations',
    lu: false,
  });

  adminNotificationId = adminNotif._id.toString();
  learnerNotificationId = learnerNotif._id.toString();
});

after(async function () {
  this.timeout(30000);

  await disconnectTestDatabase();
});

describe('Notification API', () => {
  it('GET /api/notifications should return only the learner notifications', async () => {
    const res = await request(app)
      .get('/api/notifications?page=1&limit=10')
      .set('Authorization', `Bearer ${learnerToken}`);

    expect(res.status).to.equal(200);
    expect(res.body.success).to.equal(true);
    expect(res.body.data).to.be.an('array');
    expect(res.body.data.some((n) => n._id.toString() === learnerNotificationId)).to.equal(true);
    expect(res.body.data.every((n) => n.role === 'apprenant')).to.equal(true);
  });

  it('GET /api/notifications should support onlyUnread and category filters', async () => {
    const res = await request(app)
      .get('/api/notifications?onlyUnread=true&category=reservations&page=1&limit=10')
      .set('Authorization', `Bearer ${learnerToken}`);

    expect(res.status).to.equal(200);
    expect(res.body.success).to.equal(true);
    expect(res.body.data.length).to.be.greaterThan(0);
    expect(res.body.data.every((n) => n.category === 'reservations')).to.equal(true);
    expect(res.body.data.every((n) => n.lu === false)).to.equal(true);
  });

  it('PATCH /api/notifications/:id/read should mark a learner notification as read', async () => {
    const res = await request(app)
      .patch(`/api/notifications/${learnerNotificationId}/read`)
      .set('Authorization', `Bearer ${learnerToken}`);

    expect(res.status).to.equal(200);
    expect(res.body.success).to.equal(true);
    expect(res.body.data.lu).to.equal(true);
  });

  it('PATCH /api/notifications/read-all should mark all learner notifications as read', async () => {
    const res = await request(app)
      .patch('/api/notifications/read-all')
      .set('Authorization', `Bearer ${learnerToken}`);

    expect(res.status).to.equal(200);
    expect(res.body.success).to.equal(true);
    expect(res.body.data.updatedCount).to.be.greaterThanOrEqual(0);
  });

  it('DELETE /api/notifications/:id should reject notifications from another user', async () => {
    const res = await request(app)
      .delete(`/api/notifications/${adminNotificationId}`)
      .set('Authorization', `Bearer ${learnerToken}`);

    expect(res.status).to.equal(403);
  });

  it('GET /api/notifications should be readable by admin for shared notifications', async () => {
    const res = await request(app)
      .get('/api/notifications?page=1&limit=10')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).to.equal(200);
    expect(res.body.success).to.equal(true);
    expect(res.body.data.some((n) => n.role === 'admin')).to.equal(true);
  });

  it('DELETE /api/notifications/:id should delete the learner notification if owned by user', async () => {
    const created = await Notification.create({
      role: 'apprenant',
      userId: learnerId,
      title: 'Temporary learner message',
      message: 'Delete me',
      category: 'messages',
      lu: false,
    });

    const res = await request(app)
      .delete(`/api/notifications/${created._id}`)
      .set('Authorization', `Bearer ${learnerToken}`);

    expect(res.status).to.equal(200);
    expect(res.body.success).to.equal(true);
  });

  it('PATCH /api/notifications/:id/read should deny cross-user access', async () => {
    const created = await Notification.create({
      role: 'apprenant',
      userId: otherUserId,
      title: 'Other user notification',
      message: 'Not for you',
      category: 'messages',
      lu: false,
    });

    const res = await request(app)
      .patch(`/api/notifications/${created._id}/read`)
      .set('Authorization', `Bearer ${learnerToken}`);

    expect(res.status).to.equal(403);
  });
});
