require('dotenv').config();
require('dotenv').config({ path: '.env.e2e.local' });

const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');
const mongoose = require('mongoose');
const { connectToMongoDB } = require('../config/mongo.connection');
const User = require('../src/models/User');

const localEnvPath = path.resolve('.env.e2e.local');
const accountEmail = (process.env.E2E_LEARNER_EMAIL || 'e2e-learner-local@skillbridge.test').trim().toLowerCase();
const confirmation = process.env.E2E_LOCAL_ONLY;

const createPassword = () => crypto.randomBytes(24).toString('base64url');

const writeLocalCredential = async (password) => {
  const existing = await fs.readFile(localEnvPath, 'utf8').catch(() => '');
  const lines = existing.split(/\r?\n/).filter((line) => line && !line.startsWith('E2E_LEARNER_PASSWORD='));
  lines.push(`E2E_LEARNER_PASSWORD=${password}`);
  await fs.writeFile(localEnvPath, `${lines.join('\n')}\n`, { mode: 0o600 });
};

const seed = async () => {
  if (confirmation !== 'true') {
    throw new Error('Set E2E_LOCAL_ONLY=true to run the local-only learner E2E seed.');
  }

  await connectToMongoDB();

  let user = await User.findOne({ email: accountEmail }).select('+password');
  const password = createPassword();

  if (user) {
    if (user.role !== 'apprenant') throw new Error(`E2E email is already used by role ${user.role}.`);
    user.password = password;
    user.status = 'active';
    user.emailVerified = true;
    user.profileVerified = true;
    await user.save();
  } else {
    user = await User.create({
      nom: 'SkillBridge Local E2E',
      prenom: 'Learner',
      email: accountEmail,
      password,
      role: 'apprenant',
      status: 'active',
      emailVerified: true,
      profileVerified: true,
    });
  }

  await writeLocalCredential(password);
  console.log(JSON.stringify({ email: accountEmail, role: user.role, active: user.status === 'active' }));
};

seed()
  .catch((error) => {
    console.error(`E2E learner seed failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState) await mongoose.disconnect();
  });