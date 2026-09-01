const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

let mongoServer;

const connectTestDatabase = async () => {
  if (!mongoServer) {
    mongoServer = await MongoMemoryServer.create();
    process.env.MONGO_URL = mongoServer.getUri();
    delete process.env['mongo-url'];
  }

  const { connectToMongoDB } = require('../config/mongo.connection');
  await connectToMongoDB();
};

const disconnectTestDatabase = async () => {
  if (mongoose.connection.readyState) {
    await mongoose.disconnect();
  }

  if (mongoServer) {
    await mongoServer.stop();
    mongoServer = null;
  }
};

module.exports = { connectTestDatabase, disconnectTestDatabase };
