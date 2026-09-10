const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const emailService = require('../src/services/emailService');

let mongoServer;
const ENV_KEYS_TO_RESTORE = [
  'NODE_ENV',
  'JWT_SECRET',
  'MONGO_URL',
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_SECURE',
  'SMTP_USER',
  'SMTP_PASSWORD',
  'EMAIL_FROM',
];

const snapshotEnvironment = () => {
  const snapshot = {};
  for (const key of ENV_KEYS_TO_RESTORE) {
    if (Object.prototype.hasOwnProperty.call(process.env, key)) {
      snapshot[key] = process.env[key];
    }
  }
  return snapshot;
};

const restoreEnvironment = (snapshot) => {
  for (const key of ENV_KEYS_TO_RESTORE) {
    if (Object.prototype.hasOwnProperty.call(snapshot, key)) {
      process.env[key] = snapshot[key];
    } else {
      delete process.env[key];
    }
  }
};

const connectTestDatabase = async () => {
  for (const key of ENV_KEYS_TO_RESTORE) {
    delete process.env[key];
  }
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test-secret-key';
  emailService.resetTransporter();

  if (!mongoServer) {
    mongoServer = await MongoMemoryServer.create();
  }

  const uri = mongoServer.getUri();
  process.env.MONGO_URL = uri;
  delete process.env['mongo-url'];

  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  } else if (mongoose.connection?.client?.s?.url && mongoose.connection.client.s.url !== uri) {
    await mongoose.disconnect().catch(() => undefined);
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  }
};

const disconnectTestDatabase = async () => {
  emailService.resetTransporter();
  for (const key of ENV_KEYS_TO_RESTORE) {
    delete process.env[key];
  }
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test-secret-key';
};

module.exports = { connectTestDatabase, disconnectTestDatabase, restoreEnvironment, snapshotEnvironment };
