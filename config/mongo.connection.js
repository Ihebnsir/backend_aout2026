const mongoose = require("mongoose");

const getMongoUrl = () => process.env.MONGO_URL || process.env["mongo-url"] || "mongodb://127.0.0.1:27017/skillbridge";

const connectToMongoDB = async () => {
  try {
    await mongoose.connect(getMongoUrl(), {
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