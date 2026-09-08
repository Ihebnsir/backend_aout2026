const request = require('supertest');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { expect } = require('chai');
const app = require('../app');
const User = require('../src/models/User');
const Centre = require('../src/models/Centre');
const Formation = require('../src/models/Formation');
const Reservation = require('../src/models/Reservation');
const Certification = require('../src/models/Certification');
const { connectTestDatabase } = require('./testDatabase');

const sign = (user) => jwt.sign(
  { id: user._id, role: user.role, email: user.email },
  'test-secret-key',
  { expiresIn: '1h' }
);

describe('Certification API', function () {
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
  let otherLearnerToken;
  let centreToken;

  const createCompletedReservation = (overrides = {}) => Reservation.create({
    learnerId: learner._id,
    formationId: formation._id,
    centreId: centre._id,
    price: 100,
    status: 'COMPLETED',
    ...overrides,
  });

  const issue = (overrides = {}, token = adminToken) => request(app)
    .post('/api/certifications')
    .set('Authorization', `Bearer ${token}`)
    .send({
      apprenantId: learner._id,
      formationId: formation._id,
      centreId: centre._id,
      dateObtention: new Date().toISOString(),
      ...overrides,
    });

  before(async () => {
    await connectTestDatabase();
    [admin, learner, otherLearner, centreUser] = await User.create([
      { nom: 'Admin', prenom: 'Certification', email: 'cert.admin@test.com', password: 'Password123!', role: 'admin', status: 'active' },
      { nom: 'Learner', prenom: 'Certification', email: 'cert.learner@test.com', password: 'Password123!', role: 'apprenant', status: 'active' },
      { nom: 'Other', prenom: 'Learner', email: 'cert.other@test.com', password: 'Password123!', role: 'apprenant', status: 'active' },
      { nom: 'Centre', prenom: 'Certification', email: 'cert.centre@test.com', password: 'Password123!', role: 'centre', status: 'active' },
    ]);
    [centre, otherCentre] = await Centre.create([
      { userId: centreUser._id, name: 'Certification Centre' },
      { userId: otherLearner._id, name: 'Other Certification Centre' },
    ]);
    [formation, otherFormation] = await Formation.create([
      { centre: centre._id, title: 'Certification Formation', price: 100, duration: '1 jour' },
      { centre: otherCentre._id, title: 'Other Certification Formation', price: 100, duration: '1 jour' },
    ]);
    adminToken = sign(admin);
    learnerToken = sign(learner);
    otherLearnerToken = sign(otherLearner);
    centreToken = sign(centreUser);
  });

  beforeEach(async () => {
    await Certification.deleteMany({});
    await Reservation.deleteMany({});
  });

  it('protects issuance, listing, detail, and revoke by role', async () => {
    await createCompletedReservation();
    expect((await issue({}, null)).status).to.equal(401);
    expect((await issue({}, learnerToken)).status).to.equal(403);
    expect((await request(app).get('/api/certifications').set('Authorization', `Bearer ${centreToken}`)).status).to.equal(403);

    const created = await issue();
    expect(created.status).to.equal(201);
    const id = created.body.data._id;

    expect((await request(app).get(`/api/certifications/${id}`).set('Authorization', `Bearer ${otherLearnerToken}`)).status).to.equal(403);
    expect((await request(app).patch(`/api/certifications/${id}/revoke`).set('Authorization', `Bearer ${learnerToken}`)).status).to.equal(403);
    expect((await request(app).get(`/api/certifications/${id}`).set('Authorization', `Bearer ${adminToken}`)).status).to.equal(200);
  });

  it('requires a completed, matching learner/formation/centre relationship', async () => {
    const invalidLearner = await issue({ apprenantId: otherLearner._id });
    expect(invalidLearner.status).to.equal(400);

    await createCompletedReservation();
    const mismatchedFormation = await issue({ formationId: otherFormation._id });
    expect(mismatchedFormation.status).to.equal(400);

    const mismatchedCentre = await issue({ centreId: otherCentre._id });
    expect(mismatchedCentre.status).to.equal(400);

    await Reservation.deleteMany({});
    const incomplete = await issue();
    expect(incomplete.status).to.equal(400);
  });

  it('prevents duplicate certificates and generates unique certificate numbers', async () => {
    await createCompletedReservation();
    const first = await issue();
    expect(first.status).to.equal(201);
    expect(first.body.data.numeroCertificat).to.match(/^CERT-/);

    const duplicate = await issue();
    expect(duplicate.status).to.equal(409);

    const secondLearnerReservation = await createCompletedReservation({ learnerId: otherLearner._id });
    expect(secondLearnerReservation).to.exist;
    const second = await issue({ apprenantId: otherLearner._id });
    expect(second.status).to.equal(201);
    expect(second.body.data.numeroCertificat).to.not.equal(first.body.data.numeroCertificat);
  });

  it('lists only the learner certificates with pagination and status filters', async () => {
    await createCompletedReservation();
    const created = await issue();
    expect(created.status).to.equal(201);

    const list = await request(app)
      .get('/api/certifications?page=1&limit=1&status=emise')
      .set('Authorization', `Bearer ${learnerToken}`);
    expect(list.status).to.equal(200);
    expect(list.body.data).to.have.length(1);
    expect(list.body.pagination.limit).to.equal(1);

    const invalidQuery = await request(app)
      .get('/api/certifications?page=0&status=unknown')
      .set('Authorization', `Bearer ${learnerToken}`);
    expect(invalidQuery.status).to.equal(400);
  });

  it('publicly verifies active certificates without exposing learner email', async () => {
    await createCompletedReservation();
    const created = await issue();
    const number = created.body.data.numeroCertificat;

    const verified = await request(app).get(`/api/certifications/verify/${number}`);
    expect(verified.status).to.equal(200);
    expect(verified.body.data.status).to.equal('emise');
    expect(verified.body.data.apprenant.email).to.equal(undefined);

    const malformed = await request(app).get('/api/certifications/verify/%20');
    expect(malformed.status).to.equal(400);
  });

  it('revokes certificates once and hides revoked certificates from public verification', async () => {
    await createCompletedReservation();
    const created = await issue();
    const id = created.body.data._id;
    const number = created.body.data.numeroCertificat;

    const revoked = await request(app)
      .patch(`/api/certifications/${id}/revoke`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(revoked.status).to.equal(200);
    expect(revoked.body.data.status).to.equal('revoquee');

    const repeated = await request(app)
      .patch(`/api/certifications/${id}/revoke`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(repeated.status).to.equal(409);

    const publicVerification = await request(app).get(`/api/certifications/verify/${number}`);
    expect(publicVerification.status).to.equal(404);
  });

  it('returns appropriate errors for invalid and missing certification IDs', async () => {
    const invalid = await request(app)
      .get('/api/certifications/not-an-id')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(invalid.status).to.equal(400);

    const missing = await request(app)
      .get(`/api/certifications/${new mongoose.Types.ObjectId()}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(missing.status).to.equal(404);
  });
});
