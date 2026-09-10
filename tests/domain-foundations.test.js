const request = require('supertest');
const jwt = require('jsonwebtoken');
const { expect } = require('chai');
const app = require('../app');
const User = require('../src/models/User');
const Centre = require('../src/models/Centre');
const Formation = require('../src/models/Formation');
const Reservation = require('../src/models/Reservation');
const Session = require('../src/models/Session');
const Attendance = require('../src/models/Attendance');
const Progress = require('../src/models/Progress');
const Trainer = require('../src/models/Trainer');
const Certification = require('../src/models/Certification');
const { connectTestDatabase, disconnectTestDatabase } = require('./testDatabase');

const sign = (user) => jwt.sign({ id: user._id, role: user.role, email: user.email }, 'test-secret-key', { expiresIn: '1h' });

describe('Domain foundation implementation', function () {
  this.timeout(30000);

  let admin;
  let learner;
  let centreUser;
  let otherCentreUser;
  let centre;
  let otherCentre;
  let formation;
  let otherFormation;
  let learnerToken;
  let centreToken;
  let adminToken;
  let otherCentreToken;
  let reservation;

  before(async () => {
    await connectTestDatabase();

    [admin, learner, centreUser, otherCentreUser] = await User.create([
      { nom: 'Admin', prenom: 'One', email: 'admin.foundation@test.com', password: 'Password123!', role: 'admin', status: 'active' },
      { nom: 'Learner', prenom: 'One', email: 'learner.foundation@test.com', password: 'Password123!', role: 'apprenant', status: 'active' },
      { nom: 'Centre', prenom: 'One', email: 'centre.foundation@test.com', password: 'Password123!', role: 'centre', status: 'active' },
      { nom: 'Centre', prenom: 'Two', email: 'centre2.foundation@test.com', password: 'Password123!', role: 'centre', status: 'active' },
    ]);

    [centre, otherCentre] = await Centre.create([
      { userId: centreUser._id, name: 'Foundation Centre', statutVerification: 'VERIFIE', verifie: true },
      { userId: otherCentreUser._id, name: 'Other Centre', statutVerification: 'VERIFIE', verifie: true },
    ]);

    [formation, otherFormation] = await Formation.create([
      { centre: centre._id, title: 'Node basics', description: 'Intro', price: 200, duration: '2 weeks', category: 'dev', status: 'confirmed', startDate: new Date(), endDate: new Date(Date.now() + 86400000), sessions: [] },
      { centre: otherCentre._id, title: 'Other course', description: 'Other', price: 300, duration: '3 weeks', category: 'dev', status: 'confirmed', startDate: new Date(), endDate: new Date(Date.now() + 86400000), sessions: [] },
    ]);

    reservation = await Reservation.create({
      learnerId: learner._id,
      formationId: formation._id,
      centreId: centre._id,
      status: 'CONFIRMED',
      price: 200,
      paid: true,
      paymentDate: new Date(),
    });

    adminToken = sign(admin);
    learnerToken = sign(learner);
    centreToken = sign(centreUser);
    otherCentreToken = sign(otherCentreUser);
  });

  after(async () => {
    await disconnectTestDatabase();
  });

  it('creates and lists sessions for an owned formation', async () => {
    const created = await request(app)
      .post('/api/sessions')
      .set('Authorization', `Bearer ${centreToken}`)
      .send({
        formation: formation._id.toString(),
        title: 'Session 1',
        description: 'Intro session',
        date: new Date().toISOString(),
        startTime: '09:00',
        endTime: '11:00',
        location: 'Room A',
      });

    expect(created.status).to.equal(201);
    expect(created.body.data.title).to.equal('Session 1');

    const list = await request(app)
      .get('/api/sessions')
      .set('Authorization', `Bearer ${centreToken}`);

    expect(list.status).to.equal(200);
    expect(list.body.data.some((item) => item.title === 'Session 1')).to.equal(true);
  });

  it('prevents cross-centre session ownership', async () => {
    const created = await request(app)
      .post('/api/sessions')
      .set('Authorization', `Bearer ${otherCentreToken}`)
      .send({
        formation: formation._id.toString(),
        title: 'Bad session',
        date: new Date().toISOString(),
        startTime: '10:00',
        endTime: '12:00',
        location: 'Room B',
      });

    expect(created.status).to.equal(403);
  });

  it('tracks attendance and rejects duplicate learner attendance for the same session', async () => {
    const session = await Session.create({
      formation: formation._id,
      centre: centre._id,
      title: 'Attendance class',
      date: new Date(),
      startTime: '09:00',
      endTime: '10:30',
      location: 'Room C',
    });

    const add = await request(app)
      .post('/api/attendance')
      .set('Authorization', `Bearer ${centreToken}`)
      .send({
        session: session._id.toString(),
        learner: learner._id.toString(),
        formation: formation._id.toString(),
        centre: centre._id.toString(),
        status: 'present',
        note: 'On time',
      });

    expect(add.status).to.equal(201);

    const duplicate = await request(app)
      .post('/api/attendance')
      .set('Authorization', `Bearer ${centreToken}`)
      .send({
        session: session._id.toString(),
        learner: learner._id.toString(),
        formation: formation._id.toString(),
        centre: centre._id.toString(),
        status: 'late',
      });

    expect(duplicate.status).to.equal(409);
  });

  it('allows learners to read only their own progress and validates ranges', async () => {
    const progress = await Progress.create({
      learner: learner._id,
      formation: formation._id,
      reservation: reservation._id,
      centre: centre._id,
      percentage: 75,
      completedSessions: 3,
      totalSessions: 4,
      status: 'in-progress',
    });

    const own = await request(app)
      .get('/api/progress/me')
      .set('Authorization', `Bearer ${learnerToken}`);

    expect(own.status).to.equal(200);
    expect(own.body.data.some((item) => item._id.toString() === progress._id.toString())).to.equal(true);

    const invalid = await request(app)
      .post('/api/progress')
      .set('Authorization', `Bearer ${learnerToken}`)
      .send({
        learner: learner._id.toString(),
        formation: formation._id.toString(),
        reservation: reservation._id.toString(),
        centre: centre._id.toString(),
        percentage: 101,
        completedSessions: 5,
        totalSessions: 4,
        status: 'in-progress',
      });

    expect(invalid.status).to.equal(400);
  });

  it('manages trainers for a centre and exposes a student roster aggregation', async () => {
    const trainer = await request(app)
      .post('/api/centres/me/trainers')
      .set('Authorization', `Bearer ${centreToken}`)
      .send({
        nom: 'Trainer',
        prenom: 'Alpha',
        email: 'trainer.alpha@test.com',
        telephone: '0600000000',
        specialite: 'React',
      });

    expect(trainer.status).to.equal(201);

    const roster = await request(app)
      .get('/api/centres/me/students')
      .set('Authorization', `Bearer ${centreToken}`)
      .query({ page: 1, limit: 10 });

    expect(roster.status).to.equal(200);
    expect(roster.body.data).to.be.an('array');

    const analytics = await request(app)
      .get('/api/centres/me/analytics/overview')
      .set('Authorization', `Bearer ${centreToken}`);

    expect(analytics.status).to.equal(200);
    expect(analytics.body.data).to.have.property('formations');
  });

  it('issues a real PDF certificate only for the owner or admin and denies revoked ones', async () => {
    const certification = await Certification.create({
      apprenant: learner._id,
      formation: formation._id,
      centre: centre._id,
      dateObtention: new Date(),
      numeroCertificat: 'CERT-TEST-001',
      status: 'emise',
    });

    const pdf = await request(app)
      .get(`/api/certifications/${certification._id}/pdf`)
      .set('Authorization', `Bearer ${learnerToken}`);

    expect(pdf.status).to.equal(200);
    expect(pdf.headers['content-type']).to.include('application/pdf');

    await Certification.findByIdAndUpdate(certification._id, { status: 'revoquee' });

    const revoked = await request(app)
      .get(`/api/certifications/${certification._id}/pdf`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(revoked.status).to.equal(409);
  });
});
