require('dotenv').config();

const mongoose = require('mongoose');
const { connectToMongoDB } = require('../config/mongo.connection');
const User = require('../src/models/User');

const seedUser = async () => {
  const email = (process.env.USER_EMAIL || '').trim().toLowerCase();
  const password = process.env.USER_PASSWORD;

  if (!email || !password) {
    throw new Error('USER_EMAIL et USER_PASSWORD doivent être définis.');
  }

  await connectToMongoDB();

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    console.log(`Utilisateur déjà existant : ${email}`);
    return;
  }

  await User.create({
    nom: process.env.USER_NAME || 'Ahmed',
    prenom: process.env.USER_FIRSTNAME || 'Ahmed',
    email,
    password,
    role: 'apprenant',
    status: 'active',
    emailVerified: true,
    profileVerified: false,
  });

  console.log(`Utilisateur créé avec succès : ${email}`);
};

seedUser()
  .catch((error) => {
    console.error('Erreur lors de la création de l’utilisateur :', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState) {
      await mongoose.disconnect();
    }
  });