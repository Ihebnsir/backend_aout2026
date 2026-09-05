const request = require('supertest');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { expect } = require('chai');
const app = require('../app');
const User = require('../src/models/User');
const Formation = require('../src/models/Formation');
const Reservation = require('../src/models/Reservation');
const Notification = require('../src/models/Notification');
const { connectTestDatabase } = require('./testDatabase');

let learner;
let otherLearner;
let learnerToken;
let otherLearnerToken;
let formation;

const signToken = (user) => jwt.sign(
  { id: user._id, role: user.role, email: user.email },
  'test-secret-key',
  { expiresIn: '1h' }
);

const createReservation = async (status = 'PENDING', paid = false) => Reservation.create({
  learnerId: learner._id,
  formationId: formation._id,
  centreId: formation.centre,
  price: formation.price,
  status,
  paid,
});

describe('Reservation payment API', () => {
  before(async function () {
    this.timeout(30000);
    await connectTestDatabase();

    learner = await User.create({
      nom: 'Payment',
      prenom: 'Learner',
      email: 'payment.learner@test.com',
      password: 'Password123!',
      telephone: '0600000100',
      role: 'apprenant',
      status: 'active',
    });

    otherLearner = await User.create({
      nom: 'Other',
      prenom: 'Learner',
      email: 'payment.other@test.com',
      password: 'Password123!',
      telephone: '0600000101',
      role: 'apprenant',
      status: 'active',
    });

    learnerToken = signToken(learner);
    otherLearnerToken = signToken(otherLearner);
    const formationId = new mongoose.Types.ObjectId();
    const centreId = new mongoose.Types.ObjectId();
    await Formation.collection.insertOne({
      _id: formationId,
      centre: centreId,
      title: 'Payment test formation',
      description: 'Formation used by payment endpoint tests',
      price: 250,
      duration: '2 jours',
      status: 'pending',
      offreStage: false,
      entreprisesPartenaires: [],
      sessions: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    formation = await Formation.findById(formationId);
  });

  beforeEach(async () => {
    await Reservation.deleteMany({});
    await Notification.deleteMany({});
  });

  it('allows an authenticated learner to pay their own reservation', async () => {
    const reservation = await createReservation();

    const response = await request(app)
      .patch(`/api/reservations/${reservation._id}/pay`)
      .set('Authorization', `Bearer ${learnerToken}`)
      .send({ paymentMethod: 'Carte bancaire' });

    expect(response.status).to.equal(200);
    expect(response.body.success).to.equal(true);
    expect(response.body.data.paid).to.equal(true);
    expect(response.body.data.price).to.equal(formation.price);
    expect(response.body.data.paymentMethod).to.equal('Carte bancaire');
    expect(response.body.data.transactionId).to.match(/^TXN-\d{4}-[A-Z0-9]+$/);
    expect(response.body.data.history.filter((entry) => entry.icon === 'payment')).to.have.length(1);

    const notifications = await Notification.find({ category: 'paiements' });
    expect(notifications).to.have.length(2);
  });

  it('rejects an unauthenticated payment request with 401', async () => {
    const reservation = await createReservation();

    const response = await request(app)
      .patch(`/api/reservations/${reservation._id}/pay`)
      .send({ paymentMethod: 'Carte bancaire' });

    expect(response.status).to.equal(401);
  });

  it('rejects another learner from paying someone else\'s reservation', async () => {
    const reservation = await createReservation();

    const response = await request(app)
      .patch(`/api/reservations/${reservation._id}/pay`)
      .set('Authorization', `Bearer ${otherLearnerToken}`)
      .send({ paymentMethod: 'Carte bancaire' });

    expect(response.status).to.equal(403);
    expect((await Reservation.findById(reservation._id)).paid).to.equal(false);
  });

  it('rejects an invalid reservation ID', async () => {
    const response = await request(app)
      .patch('/api/reservations/not-an-id/pay')
      .set('Authorization', `Bearer ${learnerToken}`)
      .send({ paymentMethod: 'Carte bancaire' });

    expect(response.status).to.equal(400);
  });

  it('returns 404 for a nonexistent reservation', async () => {
    const response = await request(app)
      .patch(`/api/reservations/${new mongoose.Types.ObjectId()}/pay`)
      .set('Authorization', `Bearer ${learnerToken}`)
      .send({ paymentMethod: 'Carte bancaire' });

    expect(response.status).to.equal(404);
    expect(response.body.message).to.equal('Réservation introuvable');
  });

  it('handles an already-paid reservation without creating another transaction or notification', async () => {
    const reservation = await createReservation('PENDING', true);
    reservation.paymentMethod = 'Carte bancaire';
    reservation.paymentDate = new Date();
    reservation.transactionId = 'TXN-EXISTING';
    await reservation.save();

    const response = await request(app)
      .patch(`/api/reservations/${reservation._id}/pay`)
      .set('Authorization', `Bearer ${learnerToken}`)
      .send({ paymentMethod: 'Virement bancaire' });

    expect(response.status).to.equal(409);
    expect((await Reservation.findById(reservation._id)).transactionId).to.equal('TXN-EXISTING');
    expect(await Notification.countDocuments({ category: 'paiements' })).to.equal(0);
  });

  it('rejects cancelled and completed reservations', async () => {
    for (const status of ['CANCELLED', 'COMPLETED']) {
      const reservation = await createReservation(status);
      const response = await request(app)
        .patch(`/api/reservations/${reservation._id}/pay`)
        .set('Authorization', `Bearer ${learnerToken}`)
        .send({ paymentMethod: 'Carte bancaire' });

      expect(response.status, status).to.equal(400);
      expect((await Reservation.findById(reservation._id)).paid, status).to.equal(false);
    }
  });

  it('rejects client-controlled amount fields', async () => {
    const reservation = await createReservation();

    const response = await request(app)
      .patch(`/api/reservations/${reservation._id}/pay`)
      .set('Authorization', `Bearer ${learnerToken}`)
      .send({ paymentMethod: 'Carte bancaire', amount: 1 });

    expect(response.status).to.equal(400);
    expect((await Reservation.findById(reservation._id)).paid).to.equal(false);
  });

  it('allows only one winner when two payment requests race', async () => {
    const reservation = await createReservation();
    const paymentRequest = () => request(app)
      .patch(`/api/reservations/${reservation._id}/pay`)
      .set('Authorization', `Bearer ${learnerToken}`)
      .send({ paymentMethod: 'Carte bancaire' });

    const responses = await Promise.all([paymentRequest(), paymentRequest()]);
    expect(responses.map((response) => response.status).sort()).to.deep.equal([200, 409]);

    const saved = await Reservation.findById(reservation._id);
    expect(saved.paid).to.equal(true);
    expect(saved.history.filter((entry) => entry.icon === 'payment')).to.have.length(1);
    expect(await Notification.countDocuments({ category: 'paiements' })).to.equal(2);
  });
});
