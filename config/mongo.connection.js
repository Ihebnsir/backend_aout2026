const mongoose = require("mongoose");

const getMongoUrl = () => {
  const configuredUrl = process.env.MONGO_URL;
  if (configuredUrl) return configuredUrl;
  if (process.env.NODE_ENV === 'production') return '';
  return 'mongodb://127.0.0.1:27017/skillbridge';
};

const getCurrentMongoUrl = () => {
  if (mongoose.connection?._connectionString) {
    return mongoose.connection._connectionString;
  }

  if (mongoose.connection?.client?.s?.url) {
    return mongoose.connection.client.s.url;
  }

  if (mongoose.connection?.uri) {
    return mongoose.connection.uri;
  }

  return null;
};

const connectToMongoDB = async () => {
  const targetUrl = getMongoUrl();
  const currentUrl = getCurrentMongoUrl();

  if (!targetUrl) {
    console.error('MONGO_URL is required in production');
    process.exit(1);
  }

  if (mongoose.connection.readyState === 1 && currentUrl && currentUrl === targetUrl) {
    return;
  }

  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect().catch(() => undefined);
  }

  try {
    await mongoose.connect(targetUrl, {
      serverSelectionTimeoutMS: 5000,
    });

    console.log("Connected to MongoDB");
  } catch (error) {
    console.error("Error connecting to MongoDB:", error.message);
    process.exit(1);
  }
};

module.exports = { connectToMongoDB, getMongoUrl };
console.log("MongoDB URL:", getMongoUrl().replace(/\/\/.*@/, '//***:***@'));