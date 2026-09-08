const request = require('supertest');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { expect } = require('chai');
const app = require('../app');
const User = require('../src/models/User');
const Centre = require('../src/models/Centre');
const Formation = require('../src/models/Formation');
const Reservation = require('../src/models/Reservation');
const { connectTestDatabase } = require('./testDatabase');

let adminToken;
let learner;
let otherLearner;
let centre;
let otherCentre;
let formation;
let otherFormation;
let completedReservation;

const sign = (user) => jwt.sign(
  { id: user._id, role: user.role, email: user.email },
  'test-secret-key',
  { expiresIn: '1h' }
);

describe('Certification and signalement relationship integrity', function () {
  this.timeout(30000);

  before(async () => {
    await connectTestDatabase();

    const admin = await User.create({
      nom: 'Admin',
      prenom: 'Integrity',
      email: 'integrity.admin@test.com',
      password: 'Password123!',
      role: 'admin',
      status: 'active',
    });
    learner = await User.create({
      nom: 'Learner',
      prenom: 'Integrity',
      email: 'integrity.learner@test.com',
      password: 'Password123!',
      role: 'apprenant',
      status: 'active',
    });
    otherLearner = await User.create({
      nom: 'Other',
      prenom: 'Learner',
      email: 'integrity.other.learner@test.com',
      password: 'Password123!',
      role: 'apprenant',
      status: 'active',
    });
    adminToken = sign(admin);

    [centre, otherCentre] = await Centre.create([
      { userId: admin._id, name: 'Integrity Centre' },
      { userId: otherLearner._id, name: 'Other Integrity Centre' },
    ]);
    [formation, otherFormation] = await Formation.create([
      { centre: centre._id, title: 'Integrity Formation', price: 100, duration: '1 jour' },
      { centre: otherCentre._id, title: 'Other Formation', price: 100, duration: '1 jour' },
    ]);
    completedReservation = await Reservation.create({
      learnerId: learner._id,
      formationId: formation._id,
      centreId: centre._id,
      price: 100,
      status: 'COMPLETED',
    });
    await Reservation.create({
      learnerId: learner._id,
      formationId: otherFormation._id,
      centreId: otherCentre._id,
      price: 100,
      status: 'PENDING',
    });
  });

  it('creates a certificate for matching learner, formation, centre, and completed reservation', async () => {
    const response = await request(app)
      .post('/api/certifications')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        apprenantId: learner._id,
        formationId: formation._id,
        centreId: centre._id,
        dateObtention: new Date().toISOString(),
      });

    expect(response.status).to.equal(201);
    expect(response.body.data.formation).to.equal(formation._id.toString());
    expect(response.body.data.centre).to.equal(centre._id.toString());
  });

  it('rejects a mismatched learner', async () => {
    const response = await request(app)
      .post('/api/certifications')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        apprenantId: otherLearner._id,
        formationId: formation._id,
        centreId: centre._id,
        dateObtention: new Date().toISOString(),
      });

    expect(response.status).to.equal(400);
  });

  it('rejects a mismatched formation', async () => {
    const response = await request(app)
      .post('/api/certifications')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        apprenantId: learner._id,
        formationId: otherFormation._id,
        centreId: centre._id,
        dateObtention: new Date().toISOString(),
      });

    expect(response.status).to.equal(400);
  });

  it('rejects a mismatched centre', async () => {
    const response = await request(app)
      .post('/api/certifications')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        apprenantId: learner._id,
        formationId: formation._id,
        centreId: otherCentre._id,
        dateObtention: new Date().toISOString(),
      });

    expect(response.status).to.equal(400);
  });

  it('rejects a relationship without a completed reservation', async () => {
    const response = await request(app)
      .post('/api/certifications')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        apprenantId: learner._id,
        formationId: otherFormation._id,
        centreId: otherCentre._id,
        dateObtention: new Date().toISOString(),
      });

    expect(response.status).to.equal(400);
    expect(await Reservation.findById(completedReservation._id)).to.not.equal(null);
  });

  it('accepts an existing formation target for a signalement', async () => {
    const response = await request(app)
      .post('/api/signalements')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        type: 'Contenu inapproprié',
        contenu: 'Formation à vérifier',
        cibleType: 'formation',
        cibleId: formation._id,
      });

    expect(response.status).to.equal(201);
    expect(response.body.data.cibleId.toString()).to.equal(formation._id.toString());
  });

  it('rejects nonexistent and mismatched signalement targets', async () => {
    const nonexistent = await request(app)
      .post('/api/signalements')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        type: 'Spam',
        contenu: 'Cible absente',
        cibleType: 'formation',
        cibleId: new mongoose.Types.ObjectId(),
      });
    expect(nonexistent.status).to.equal(404);

    const mismatched = await request(app)
      .post('/api/signalements')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        type: 'Spam',
        contenu: 'Type incorrect',
        cibleType: 'centre',
        cibleId: formation._id,
      });
    expect(mismatched.status).to.equal(404);
  });

  it('rejects invalid signalement target IDs', async () => {
    const response = await request(app)
      .post('/api/signalements')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        type: 'Spam',
        contenu: 'ID incorrect',
        cibleType: 'formation',
        cibleId: 'not-an-id',
      });

    expect(response.status).to.equal(400);
  });
});