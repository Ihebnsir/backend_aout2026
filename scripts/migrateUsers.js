const mongoose = require('mongoose');
const { connectToMongoDB } = require('../config/mongo.connection');
const User = require('../src/models/User');

const normalizeStatus = (status) => {
  if (!status) return 'active';

  const normalized = String(status).trim().toLowerCase();

  const map = {
    actif: 'active',
    active: 'active',
    inactif: 'inactive',
    inactive: 'inactive',
    desactive: 'inactive',
    disabled: 'inactive',
    en_attente: 'pending',
    pending: 'pending',
    'en attente': 'pending',
    suspendu: 'suspended',
    suspended: 'suspended',
  };

  return map[normalized] || normalized;
};

const migrateUsers = async () => {
  try {
    await connectToMongoDB();

    const users = await User.find({});

    for (const user of users) {
      const update = { $set: {}, $unset: {} };

      if (user.emailVerified === undefined) {
        update.$set.emailVerified = user.emailVerifie ?? false;
      }

      if (user.profileVerified === undefined) {
        update.$set.profileVerified = user.profilVerifie ?? false;
      }

      if (user.lastLoginAt === undefined) {
        update.$set.lastLoginAt = user.derniereConnexion ?? null;
      }

      if (user.ville === undefined) {
        update.$set.ville = user.ville ?? '';
      }

      if (user.emailVerifie !== undefined && user.emailVerified === undefined) {
        update.$unset.emailVerifie = 1;
      }

      if (user.profilVerifie !== undefined && user.profileVerified === undefined) {
        update.$unset.profilVerifie = 1;
      }

      if (user.derniereConnexion !== undefined && user.lastLoginAt === undefined) {
        update.$unset.derniereConnexion = 1;
      }

      const normalizedStatus = normalizeStatus(user.status);
      if (user.status && normalizedStatus !== user.status) {
        update.$set.status = normalizedStatus;
      }

      if (Object.keys(update.$set).length || Object.keys(update.$unset).length) {
        await User.updateOne({ _id: user._id }, update);
      }
    }

    console.log(`Migration User terminée : ${users.length} utilisateur(s) vérifié(s).`);
  } catch (error) {
    console.error('Erreur migration utilisateurs :', error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
};

migrateUsers();
