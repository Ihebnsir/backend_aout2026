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

const localEnvPath = path.resolve('.env.e2e.local');
const accountEmail = (process.env.E2E_CENTRE_EMAIL || 'centre.e2e.local@skillbridge.test').trim().toLowerCase();
const confirmation = process.env.E2E_LOCAL_ONLY;

const createPassword = () => crypto.randomBytes(24).toString('base64url');

const writeLocalCredential = async (password) => {
  const existing = await fs.readFile(localEnvPath, 'utf8').catch(() => '');
  const lines = existing.split(/\r?\n/).filter((line) => line && !line.startsWith('E2E_CENTRE_PASSWORD='));
  lines.push(`E2E_CENTRE_PASSWORD=${password}`);
  await fs.writeFile(localEnvPath, `${lines.join('\n')}\n`, { mode: 0o600 });
};

const seed = async () => {
  if (confirmation !== 'true') {
    throw new Error('Set E2E_LOCAL_ONLY=true to run the local-only Centre E2E seed.');
  }

  await connectToMongoDB();

  let user = await User.findOne({ email: accountEmail }).select('+password');
  const password = createPassword();

  if (user) {
    if (user.role !== 'centre') throw new Error(`E2E email is already used by role ${user.role}.`);
    user.password = password;
    user.status = 'active';
    user.emailVerified = true;
    user.profileVerified = true;
    await user.save();
  } else {
    user = await User.create({
      nom: 'SkillBridge Local E2E',
      prenom: 'Centre',
      email: accountEmail,
      password,
      role: 'centre',
      status: 'active',
      emailVerified: true,
      profileVerified: true,
    });
  }

  let centre = await Centre.findOne({ userId: user._id });
  if (!centre) {
    centre = await Centre.create({
      userId: user._id,
      name: 'SkillBridge Local E2E Centre',
      responsable: 'Local E2E Test',
      description: 'Dedicated local E2E test centre.',
      domaine: 'Testing',
      ville: 'Local',
      adresse: 'Local test environment',
      email: accountEmail,
      telephone: '00000000',
      statutVerification: 'VERIFIE',
      verifie: true,
      profileCompletion: 100,
    });
  }

  let formation = await Formation.findOne({ centre: centre._id, title: 'SkillBridge Local E2E Formation' });
  if (!formation) {
    formation = await Formation.create({
      centre: centre._id,
      title: 'SkillBridge Local E2E Formation',
      description: 'Dedicated real formation for local Centre E2E verification.',
      price: 0,
      duration: '1 day',
      category: 'Testing',
      status: 'confirmed',
      sessions: [{ title: 'E2E session', order: 1 }],
    });
  }

  await writeLocalCredential(password);
  console.log(JSON.stringify({ email: accountEmail, role: user.role, active: user.status === 'active', centreId: String(centre._id), formationId: String(formation._id) }));
};

seed()
  .catch((error) => {
    console.error(`E2E Centre seed failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState) await mongoose.disconnect();
  });