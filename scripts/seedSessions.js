require('dotenv').config();

const mongoose = require('mongoose');
const { connectToMongoDB } = require('../config/mongo.connection');
const Formation = require('../src/models/Formation');

const defaultSessions = [
  { title: 'Introduction et objectifs', description: 'Présentation de la formation et des compétences visées.', duration: '3 heures', order: 1 },
  { title: 'Fondamentaux', description: 'Acquisition des notions essentielles du programme.', duration: '6 heures', order: 2 },
  { title: 'Mise en pratique', description: 'Exercices guidés et application sur des cas concrets.', duration: '6 heures', order: 3 },
  { title: 'Projet final', description: 'Réalisation et présentation d’un projet de synthèse.', duration: '6 heures', order: 4 },
];

const seedSessions = async () => {
  await connectToMongoDB();

  const result = await Formation.updateMany(
    { $or: [{ sessions: { $exists: false } }, { sessions: { $size: 0 } }] },
    { $set: { sessions: defaultSessions } }
  );

  console.log(`Sessions ajoutées à ${result.modifiedCount} formation(s).`);
};

seedSessions()
  .catch((error) => {
    console.error('Erreur lors du seed des sessions :', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState) {
      await mongoose.disconnect();
    }
  });