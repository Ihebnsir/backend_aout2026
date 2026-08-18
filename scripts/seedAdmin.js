require('dotenv').config();

const mongoose = require('mongoose');
const { connectToMongoDB } = require('../config/mongo.connection');
const User = require('../src/models/User');

const seedAdmin = async () => {
  const password = process.env.ADMIN_PASSWORD;

  if (!password || password === 'CHANGE_ME') {
    throw new Error('ADMIN_PASSWORD doit être défini dans .env avec une valeur réelle.');
  }

  const email = (process.env.ADMIN_EMAIL || 'admin@skillbridge.tn').trim().toLowerCase();

  await connectToMongoDB();
  console.log('Connexion MongoDB établie.');

  const existingUser = await User.findOne({ email });

  if (existingUser) {
    if (existingUser.role === 'admin') {
      console.log('Admin déjà existant.');
      return;
    }

    throw new Error(`L'email ${email} est déjà utilisé par un utilisateur qui n'est pas administrateur.`);
  }

  const admin = new User({
    nom: process.env.ADMIN_NAME || 'SkillBridge',
    prenom: process.env.ADMIN_FIRSTNAME || 'Administrator',
    email,
    password,
    telephone: '',
    ville: '',
    role: 'admin',
    status: 'active',
    avatar: '',
    permissions: [],
    emailVerified: true,
    profileVerified: true,
    lastLoginAt: null,
  });

  await admin.save();
  console.log('Administrateur initial créé avec succès.');
};

seedAdmin()
  .catch((error) => {
    console.error('Erreur lors du bootstrap administrateur :', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState) {
      await mongoose.disconnect();
    }
  });
