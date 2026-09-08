const request = require('supertest');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { expect } = require('chai');
const app = require('../app');
const User = require('../src/models/User');
const Litige = require('../src/models/Litige');
const Centre = require('../src/models/Centre');
const Formation = require('../src/models/Formation');
const Reservation = require('../src/models/Reservation');
const { connectTestDatabase } = require('./testDatabase');

let admin;
let learner;
let adminToken;
let learnerToken;
let otherLearner;
let centreUser;
let otherCentreUser;
let centre;
let otherCentre;
let formation;
let otherFormation;
let centreToken;
let otherCentreToken;

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

    [otherLearner, centreUser, otherCentreUser] = await User.create([
      {
        nom: 'Other',
        prenom: 'Learner',
        email: 'litige.other.learner@test.com',
        password: 'Password123!',
        role: 'apprenant',
        status: 'active',
      },
      {
        nom: 'Centre',
        prenom: 'One',
        email: 'litige.centre.one@test.com',
        password: 'Password123!',
        role: 'centre',
        status: 'active',
      },
      {
        nom: 'Centre',
        prenom: 'Two',
        email: 'litige.centre.two@test.com',
        password: 'Password123!',
        role: 'centre',
        status: 'active',
      },
    ]);

    [centre, otherCentre] = await Centre.create([
      { userId: centreUser._id, name: 'Litige Centre One' },
      { userId: otherCentreUser._id, name: 'Litige Centre Two' },
    ]);
    [formation, otherFormation] = await Formation.create([
      { centre: centre._id, title: 'Litige Formation One', price: 100, duration: '1 jour' },
      { centre: otherCentre._id, title: 'Litige Formation Two', price: 100, duration: '1 jour' },
    ]);

    adminToken = signToken(admin);
    learnerToken = signToken(learner);
    centreToken = signToken(centreUser);
    otherCentreToken = signToken(otherCentreUser);
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

  it('restricts /me to learners and centres and scopes each participant', async () => {
    const learnerLitige = await createLitige({ centre: centre._id });
    await Litige.create({
      numeroDossier: `LIT-TEST-${new mongoose.Types.ObjectId()}`,
      titre: 'Other learner litige',
      description: 'Other learner description',
      categorie: 'Réservation',
      etudiant: otherLearner._id,
      centre: otherCentre._id,
    });

    const learnerResponse = await request(app)
      .get('/api/litiges/me')
      .set('Authorization', `Bearer ${learnerToken}`);
    expect(learnerResponse.status).to.equal(200);
    expect(learnerResponse.body.data).to.have.length(1);
    expect(learnerResponse.body.data[0]._id.toString()).to.equal(learnerLitige._id.toString());

    const unauthenticated = await request(app).get('/api/litiges/me');
    expect(unauthenticated.status).to.equal(401);

    const adminResponse = await request(app)
      .get('/api/litiges/me')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(adminResponse.status).to.equal(403);

    const centreResponse = await request(app)
      .get('/api/litiges/me')
      .set('Authorization', `Bearer ${centreToken}`);
    expect(centreResponse.status).to.equal(200);
    expect(centreResponse.body.data).to.have.length(1);
    expect(centreResponse.body.data[0].centre._id.toString()).to.equal(centre._id.toString());
  });

  it('blocks cross-participant detail and conversation access', async () => {
    const learnerLitige = await createLitige({ centre: centre._id });
    const centreLitige = await Litige.create({
      numeroDossier: `LIT-TEST-${new mongoose.Types.ObjectId()}`,
      titre: 'Centre litige',
      description: 'Centre description',
      categorie: 'Communication',
      etudiant: learner._id,
      centre: otherCentre._id,
    });

    const learnerDetail = await request(app)
      .get(`/api/litiges/${centreLitige._id}`)
      .set('Authorization', `Bearer ${learnerToken}`);
    expect(learnerDetail.status).to.equal(200);

    const otherLearnerDetail = await request(app)
      .get(`/api/litiges/${learnerLitige._id}`)
      .set('Authorization', `Bearer ${signToken(otherLearner)}`);
    expect(otherLearnerDetail.status).to.equal(403);

    const otherCentreDetail = await request(app)
      .get(`/api/litiges/${learnerLitige._id}`)
      .set('Authorization', `Bearer ${otherCentreToken}`);
    expect(otherCentreDetail.status).to.equal(403);

    const otherCentreMessage = await request(app)
      .post(`/api/litiges/${learnerLitige._id}/messages`)
      .set('Authorization', `Bearer ${otherCentreToken}`)
      .send({ message: 'Cross-centre message' });
    expect(otherCentreMessage.status).to.equal(403);
  });

  it('allows assignment only to active administrators', async () => {
    const litige = await createLitige({ centre: centre._id });
    const inactiveAdmin = await User.create({
      nom: 'Inactive',
      prenom: 'Admin',
      email: 'litige.inactive.admin@test.com',
      password: 'Password123!',
      role: 'admin',
      status: 'inactive',
    });

    const valid = await request(app)
      .patch(`/api/litiges/${litige._id}/assign`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ responsableId: admin._id });
    expect(valid.status).to.equal(200);

    for (const responsableId of [learner._id, centreUser._id, inactiveAdmin._id, new mongoose.Types.ObjectId()]) {
      const response = await request(app)
        .patch(`/api/litiges/${litige._id}/assign`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ responsableId });
      expect(response.status).to.be.oneOf([400, 404]);
    }
  });

  it('validates attachment metadata without implementing file storage', async () => {
    const litige = await createLitige({ centre: centre._id });
    const valid = await request(app)
      .post(`/api/litiges/${litige._id}/pieces-jointes`)
      .set('Authorization', `Bearer ${learnerToken}`)
      .send({ nom: 'preuve.pdf', type: 'application/pdf', url: 'https://example.com/preuve.pdf', taille: 1024 });
    expect(valid.status).to.equal(201);

    for (const body of [
      { nom: 'unsafe', type: 'application/pdf', url: 'file:///C:/secret.txt' },
      { nom: 'bad', type: 'not-a-mime', url: 'https://example.com/file' },
      { nom: 'large', type: 'application/pdf', url: 'https://example.com/file', taille: 52428801 },
    ]) {
      const response = await request(app)
        .post(`/api/litiges/${litige._id}/pieces-jointes`)
        .set('Authorization', `Bearer ${learnerToken}`)
        .send(body);
      expect(response.status).to.equal(400);
    }
  });

  it('rejects inconsistent reservation relationships and enforces closure/archive lifecycle', async () => {
    const reservation = await Reservation.create({
      learnerId: learner._id,
      formationId: formation._id,
      centreId: centre._id,
      price: 100,
      status: 'COMPLETED',
    });

    const mismatch = await request(app)
      .post('/api/litiges')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        titre: 'Mismatch',
        description: 'Mismatch',
        categorie: 'Réservation',
        etudiant: learner._id,
        centre: centre._id,
        formation: otherFormation._id,
        reservation: reservation._id,
      });
    expect(mismatch.status).to.equal(400);

    const litige = await createLitige({ centre: centre._id, statut: 'decision' });
    const closed = await request(app)
      .patch(`/api/litiges/${litige._id}/cloturer`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ decisionFinale: 'Décision de test' });
    expect(closed.status).to.equal(200);
    expect(closed.body.data.statut).to.equal('resolu');

    const archived = await request(app)
      .patch(`/api/litiges/${litige._id}/archiver`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(archived.status).to.equal(200);
    expect(archived.body.data.statut).to.equal('archive');
  });
});
