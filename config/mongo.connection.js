const mongoose = require("mongoose");

const mongoUrl = process.env.MONGO_URL || process.env["mongo-url"];

const connectToMongoDB = async () => {
  try {
    if (!mongoUrl) {
      throw new Error("La variable d'environnement MONGO_URL n'est pas définie.");
    }

    await mongoose.connect(mongoUrl, {
      serverSelectionTimeoutMS: 5000,
    });

    console.log("Connected to MongoDB");
  } catch (error) {
    console.error("Error connecting to MongoDB:", error);
    process.exit(1);
  }
};

module.exports = { connectToMongoDB };
   