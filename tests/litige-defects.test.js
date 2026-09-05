const request = require('supertest');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { expect } = require('chai');
const app = require('../app');
const User = require('../src/models/User');
const Litige = require('../src/models/Litige');
const { connectTestDatabase } = require('./testDatabase');

let admin;
let learner;
let adminToken;
let learnerToken;

const signToken = (user) => jwt.sign(
  { id: user._id, role: user.role, email: user.email },
  process.env.JWT_SECRET,
  { expiresIn: '1h' }
);

const createLitige = (overrides = {}) => Litige.create({
  numeroDossier: `LIT-TEST-${new mongoose.Types.ObjectId()}`,
  titre: 'Litige de test',
  description: 'Description du litige de test',
  categorie: 'Réservation',
  etudiant: learner._id,
  centre: new mongoose.Types.ObjectId(),
  ...overrides,
});

describe('Litige and JWT defect regressions', () => {
  before(async function () {
    this.timeout(30000);
    await connectTestDatabase();

    admin = await User.create({
      nom: 'Admin',
      prenom: 'Litige',
      email: 'litige.admin@test.com',
      password: 'Password123!',
      telephone: '0600000200',
      role: 'admin',
      status: 'active',
    });

    learner = await User.create({
      nom: 'Learner',
      prenom: 'Litige',
      email: 'litige.learner@test.com',
      password: 'Password123!',
      telephone: '0600000201',
      role: 'apprenant',
      status: 'active',
    });

    adminToken = signToken(admin);
    learnerToken = signToken(learner);
  });

  beforeEach(async () => {
    await Litige.deleteMany({});
  });

  it('returns success after updating a litige status', async () => {
    const litige = await createLitige();

    const response = await request(app)
      .patch(`/api/litiges/${litige._id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ statut: 'analyse' });

    expect(response.status).to.equal(200);
    expect(response.body.success).to.equal(true);
    expect(response.body.data.statut).to.equal('analyse');
    expect((await Litige.findById(litige._id)).statut).to.equal('analyse');
  });

  it('persists learner conversation messages with the apprenant role', async () => {
    const litige = await createLitige();

    const response = await request(app)
      .post(`/api/litiges/${litige._id}/messages`)
      .set('Authorization', `Bearer ${learnerToken}`)
      .send({ message: 'Message de test' });

    expect(response.status).to.equal(201);
    expect(response.body.success).to.equal(true);

    const saved = await Litige.findById(litige._id).lean();
    expect(saved.conversation).to.have.length(1);
    expect(saved.conversation[0].role).to.equal('apprenant');
    expect(saved.conversation[0].message).to.equal('Message de test');
  });

  it('fails safely when JWT_SECRET is missing', () => {
    const originalSecret = process.env.JWT_SECRET;
    delete process.env.JWT_SECRET;

    const middlewarePath = require.resolve('../src/middleware/authMiddleware');
    delete require.cache[middlewarePath];
    const { authenticate } = require('../src/middleware/authMiddleware');
    let receivedError;

    authenticate({ headers: {} }, {}, (error) => {
      receivedError = error;
    });

    expect(receivedError).to.exist;
    expect(receivedError.status).to.equal(503);

    if (originalSecret === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = originalSecret;
    }
    delete require.cache[middlewarePath];
  });
});
