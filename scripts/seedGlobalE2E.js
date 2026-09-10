require('dotenv').config();
require('dotenv').config({ path: '.env.e2e.local' });

const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');
const mongoose = require('mongoose');
const { connectToMongoDB } = require('../config/mongo.connection');
const User = require('../src/models/User');
const Centre = require('../src/models/Centre');
const Formation = require('../src/models/Formation');
const Reservation = require('../src/models/Reservation');
const Session = require('../src/models/Session');
const Attendance = require('../src/models/Attendance');
const Progress = require('../src/models/Progress');
const Notification = require('../src/models/Notification');
const Conversation = require('../src/models/Conversation');
const Message = require('../src/models/Message');
const Signalement = require('../src/models/Signalement');
const Certification = require('../src/models/Certification');
const CentreNote = require('../src/models/CentreNote');

const localEnvPath = path.resolve('.env.e2e.local');
const learnerEmail = (process.env.E2E_LEARNER_EMAIL || 'e2e-learner-local@skillbridge.test').trim().toLowerCase();
const centreEmail = (process.env.E2E_CENTRE_EMAIL || 'centre.e2e.local@skillbridge.test').trim().toLowerCase();
const adminEmail = (process.env.E2E_ADMIN_EMAIL || 'admin.e2e.local@skillbridge.test').trim().toLowerCase();
const centreName = 'SkillBridge Local E2E Centre';
const formationTitle = 'SkillBridge Local E2E Formation';
const secondFormationTitle = 'SkillBridge Local E2E Advanced Formation';

const createPassword = () => crypto.randomBytes(24).toString('base64url');

const writeCredential = async (key, password) => {
  const existing = await fs.readFile(localEnvPath, 'utf8').catch(() => '');
  const lines = existing.split(/\r?\n/).filter((line) => line && !line.startsWith(`${key}=`));
  lines.push(`${key}=${password}`);
  await fs.writeFile(localEnvPath, `${lines.join('\n')}\n`, { mode: 0o600 });
};

const ensureUser = async ({ email, role, passwordKey, nom, prenom }) => {
  let user = await User.findOne({ email }).select('+password');
  if (user && user.role !== role) throw new Error('E2E account role conflict');

  const password = process.env[passwordKey] || createPassword();
  if (!user) {
    user = new User({ email, role, nom, prenom });
  }
  user.password = password;
  user.status = 'active';
  user.emailVerified = true;
  user.profileVerified = true;
  await user.save();
  await writeCredential(passwordKey, password);
  return user;
};

const ensureFormation = async ({ centreId, title, price }) => {
  let formation = await Formation.findOne({ centre: centreId, title });
  if (!formation) {
    formation = new Formation({
      centre: centreId,
      title,
      description: 'Real formation data dedicated to the SkillBridge global E2E flow.',
      price,
      duration: '5 days',
      category: 'Testing',
      status: 'confirmed',
      sessions: [
        { title: 'E2E introduction', description: 'Introduction session.', duration: '3 hours', order: 1 },
        { title: 'E2E practice', description: 'Practice session.', duration: '3 hours', order: 2 },
      ],
    });
  } else {
    formation.price = price;
    formation.status = 'confirmed';
    if (!formation.sessions?.length) {
      formation.sessions = [{ title: 'E2E introduction', description: 'Introduction session.', duration: '3 hours', order: 1 }];
    }
  }
  await formation.save();
  return formation;
};

const ensureReservation = async ({ learnerId, formation, centreId, status, paid }) => {
  const paymentDate = paid ? new Date('2026-08-03T11:15:00.000Z') : null;
  const update = {
    status,
    paid,
    paymentDate,
    paymentMethod: paid ? 'Carte bancaire' : null,
    transactionId: paid ? `E2E-${formation._id}` : null,
    price: formation.price,
    centreId,
    history: [{ date: new Date('2026-08-01T09:00:00.000Z'), action: 'Réservation créée', icon: 'create' }],
  };
  if (paid) update.history.push({ date: paymentDate, action: 'Paiement effectué', icon: 'payment' });
  if (status === 'COMPLETED') update.history.push({ date: new Date('2026-08-30T16:00:00.000Z'), action: 'Formation terminée', icon: 'completed' });

  return Reservation.findOneAndUpdate(
    { learnerId, formationId: formation._id },
    { $set: update, $setOnInsert: { learnerId, formationId: formation._id } },
    { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true }
  );
};

const ensureData = async ({ learner, centreUser, centre, completedFormation, activeFormation }) => {
  const completedReservation = await ensureReservation({
    learnerId: learner._id,
    formation: completedFormation,
    centreId: centre._id,
    status: 'COMPLETED',
    paid: true,
  });
  await ensureReservation({
    learnerId: learner._id,
    formation: activeFormation,
    centreId: centre._id,
    status: 'CONFIRMED',
    paid: false,
  });

  const session = await Session.findOneAndUpdate(
    { formation: completedFormation._id, title: 'Global E2E session' },
    {
      $set: {
        centre: centre._id,
        date: new Date('2026-09-15T09:00:00.000Z'),
        description: 'Real session data for global E2E verification.',
        startTime: '09:00',
        endTime: '12:00',
        location: 'SkillBridge E2E room',
        status: 'completed',
      },
      $setOnInsert: { formation: completedFormation._id, title: 'Global E2E session' },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true }
  );

  await Attendance.findOneAndUpdate(
    { session: session._id, learner: learner._id },
    { $set: { formation: completedFormation._id, centre: centre._id, status: 'present', markedBy: centreUser._id } },
    { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true }
  );

  await Progress.findOneAndUpdate(
    { learner: learner._id, formation: completedFormation._id },
    { $set: { reservation: completedReservation._id, centre: centre._id, percentage: 100, completedSessions: 2, totalSessions: 2, status: 'completed' } },
    { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true }
  );

  await Notification.findOneAndUpdate(
    { role: 'apprenant', userId: learner._id, category: 'paiements', title: 'E2E payment notification' },
    { $set: { message: 'Payment state available for E2E verification.', lu: false } },
    { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true }
  );
  await Notification.findOneAndUpdate(
    { role: 'centre', userId: centreUser._id, category: 'sessions', title: 'E2E session notification' },
    { $set: { message: 'Session state available for E2E verification.', lu: false } },
    { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true }
  );

  const directKey = `e2e:${learner._id}:${centreUser._id}:${activeFormation._id}`;
  const conversation = await Conversation.findOneAndUpdate(
    { directKey },
    { $set: { type: 'direct', learnerUserId: learner._id, centreUserId: centreUser._id, centreId: centre._id, formationId: activeFormation._id } },
    { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true }
  );
  const message = await Message.findOneAndUpdate(
    { conversationId: conversation._id, clientMessageId: 'global-e2e-message' },
    { $set: { senderId: learner._id, senderRole: 'apprenant', content: 'Global E2E message.' } },
    { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true }
  );
  await Conversation.updateOne(
    { _id: conversation._id },
    { $set: { lastMessage: { messageId: message._id, senderId: learner._id, contentPreview: 'Global E2E message.', createdAt: message.createdAt }, lastMessageAt: message.createdAt } }
  );

  await Signalement.findOneAndUpdate(
    { reporter: learner._id, cibleType: 'formation', cibleId: activeFormation._id, contenu: 'Global E2E report.' },
    { $set: { type: 'Problème technique', status: 'En attente' } },
    { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true }
  );

  await Certification.findOneAndUpdate(
    { apprenant: learner._id, formation: completedFormation._id },
    { $set: { centre: centre._id, dateObtention: new Date('2026-08-30T16:00:00.000Z'), status: 'emise', pdfGenere: false } },
    { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true }
  );

  await CentreNote.findOneAndUpdate(
    { apprenant: learner._id, centre: centre._id, formation: completedFormation._id },
    { $set: { note: 5, commentaire: 'Global E2E rating.' } },
    { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true }
  );
};

const seed = async () => {
  await connectToMongoDB();

  const [learner, centreUser, admin] = await Promise.all([
    ensureUser({ email: learnerEmail, role: 'apprenant', passwordKey: 'E2E_LEARNER_PASSWORD', nom: 'SkillBridge Local E2E', prenom: 'Learner' }),
    ensureUser({ email: centreEmail, role: 'centre', passwordKey: 'E2E_CENTRE_PASSWORD', nom: 'SkillBridge Local E2E', prenom: 'Centre' }),
    ensureUser({ email: adminEmail, role: 'admin', passwordKey: 'E2E_ADMIN_PASSWORD', nom: 'SkillBridge Local E2E', prenom: 'Admin' }),
  ]);

  const centre = await Centre.findOneAndUpdate(
    { userId: centreUser._id },
    { $set: { name: centreName, responsable: 'Global E2E Test', description: 'Real centre data for global E2E verification.', domaine: 'Testing', ville: 'Local', adresse: 'Local test environment', email: centreEmail, telephone: '00000000', statutVerification: 'VERIFIE', verifie: true, profileCompletion: 100 } },
    { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true }
  );
  const completedFormation = await ensureFormation({ centreId: centre._id, title: formationTitle, price: 250 });
  const activeFormation = await ensureFormation({ centreId: centre._id, title: secondFormationTitle, price: 150 });
  await ensureData({ learner, centreUser, centre, completedFormation, activeFormation });

  console.log('Global E2E data ready');
  console.log(JSON.stringify({ learner: 'READY', centre: 'READY', admin: 'READY', data: 'READY' }));
};

seed()
  .catch(() => {
    console.error('Global E2E seed failed');
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState) await mongoose.disconnect();
  });