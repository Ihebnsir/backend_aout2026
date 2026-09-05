require('dotenv').config();

const mongoose = require('mongoose');
const { connectToMongoDB } = require('../config/mongo.connection');
const User = require('../src/models/User');
const Formation = require('../src/models/Formation');
const Reservation = require('../src/models/Reservation');

const reservationTemplates = [
  { learnerIndex: 0, formationIndex: 0, status: 'PENDING', paid: false },
  { learnerIndex: 0, formationIndex: 2, status: 'CONFIRMED', paid: true, paymentMethod: 'Carte bancaire', transactionId: 'TXN-SEED-001' },
  { learnerIndex: 1, formationIndex: 1, status: 'CONFIRMED', paid: true, paymentMethod: 'Virement bancaire', transactionId: 'TXN-SEED-002' },
  { learnerIndex: 1, formationIndex: 4, status: 'PENDING', paid: false },
  { learnerIndex: 2, formationIndex: 3, status: 'COMPLETED', paid: true, paymentMethod: 'Carte bancaire', transactionId: 'TXN-SEED-003' },
  { learnerIndex: 2, formationIndex: 6, status: 'CONFIRMED', paid: true, paymentMethod: 'Virement bancaire', transactionId: 'TXN-SEED-004' },
  { learnerIndex: 3, formationIndex: 5, status: 'CANCELLED', paid: false },
  { learnerIndex: 3, formationIndex: 7, status: 'PENDING', paid: false },
  { learnerIndex: 0, formationIndex: 8, status: 'COMPLETED', paid: true, paymentMethod: 'Carte bancaire', transactionId: 'TXN-SEED-005' },
  { learnerIndex: 1, formationIndex: 10, status: 'CANCELLED', paid: false },
];

const buildHistory = (status, paid) => {
  const history = [{
    date: new Date('2026-08-01T09:00:00.000Z'),
    action: 'Réservation créée',
    icon: 'create',
  }];

  if (status === 'CONFIRMED' || status === 'COMPLETED') {
    history.push({
      date: new Date('2026-08-02T09:00:00.000Z'),
      action: 'Réservation confirmée',
      icon: 'confirm',
    });
  }

  if (status === 'COMPLETED') {
    history.push({
      date: new Date('2026-08-30T16:00:00.000Z'),
      action: 'Formation terminée',
      icon: 'completed',
    });
  }

  if (status === 'CANCELLED') {
    history.push({
      date: new Date('2026-08-05T10:30:00.000Z'),
      action: 'Réservation annulée',
      icon: 'cancel',
    });
  }

  if (paid) {
    history.push({
      date: new Date('2026-08-03T11:15:00.000Z'),
      action: 'Paiement effectué',
      icon: 'payment',
    });
  }

  return history;
};

const seedReservations = async () => {
  await connectToMongoDB();

  const [learners, formations] = await Promise.all([
    User.find({ role: 'apprenant', status: 'active' }, { _id: 1, nom: 1, prenom: 1, email: 1 })
      .sort({ email: 1 })
      .lean(),
    Formation.find({}, { _id: 1, title: 1, price: 1, centre: 1 })
      .sort({ createdAt: 1, _id: 1 })
      .lean(),
  ]);

  if (learners.length === 0) {
    throw new Error('Aucun apprenant actif trouvé : aucune réservation ne sera créée.');
  }

  if (formations.length === 0) {
    throw new Error('Aucune formation réelle trouvée : aucune réservation ne sera créée.');
  }

  const reservations = reservationTemplates.map(({ learnerIndex, formationIndex, ...template }) => {
    const learner = learners[learnerIndex % learners.length];
    const formation = formations[formationIndex % formations.length];
    const paymentDate = template.paid ? new Date('2026-08-03T11:15:00.000Z') : null;

    return {
      learnerId: learner._id,
      formationId: formation._id,
      centreId: formation.centre,
      price: formation.price,
      ...template,
      paymentDate,
      history: buildHistory(template.status, template.paid),
    };
  });

  const before = await Reservation.countDocuments();
  const operations = reservations.map((reservation) => ({
    updateOne: {
      filter: {
        learnerId: reservation.learnerId,
        formationId: reservation.formationId,
      },
      update: { $setOnInsert: reservation },
      upsert: true,
    },
  }));
  const result = await Reservation.bulkWrite(operations, { ordered: true });
  const after = await Reservation.countDocuments();

  console.log(`Apprenants actifs trouvés : ${learners.length}`);
  console.log(`Formations réelles trouvées : ${formations.length}`);
  console.log(`Réservations avant : ${before}`);
  console.log(`Réservations insérées : ${result.upsertedCount}`);
  console.log(`Réservations après : ${after}`);
  console.log('Clé d’idempotence : (learnerId, formationId)');
  console.log('Aucun mock user ID, formation ID ou reservation ID utilisé.');
};

seedReservations()
  .catch((error) => {
    console.error('Erreur lors du seed des réservations :', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState) {
      await mongoose.disconnect();
    }
  });