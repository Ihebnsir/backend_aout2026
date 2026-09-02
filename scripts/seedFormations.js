require('dotenv').config();

const mongoose = require('mongoose');
const { connectToMongoDB } = require('../config/mongo.connection');
const Formation = require('../src/models/Formation');
const Centre = require('../src/models/Centre');

const sourceFormations = [
  { id: 'form-1', centreId: 'centre-1', title: 'React Avancé', price: 499, duration: '6 semaines', category: 'Développement', categorie: 'dev-web', status: 'confirmed', offreStage: true, entreprisesPartenaires: ['Orange', 'STMicroelectronics'], startDate: '2026-08-15', endDate: '2026-09-26', progress: 65, image: 'https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=800&h=600&fit=crop&q=80' },
  { id: 'form-2', centreId: 'centre-2', title: 'UI/UX Design', price: 399, duration: '5 semaines', category: 'Design', categorie: 'data-bi', status: 'in-progress', offreStage: true, entreprisesPartenaires: ['Mynk'], startDate: '2026-07-20', endDate: '2026-08-24', progress: 35, image: 'https://images.unsplash.com/photo-1561070791-2526d30994b5?w=800&h=600&fit=crop&q=80' },
  { id: 'form3', centreId: 'centre-1', title: 'Node.js & Express Maître', price: 549, duration: '7 semaines', category: 'Développement', categorie: 'dev-web', status: 'completed', offreStage: false, entreprisesPartenaires: [], startDate: '2026-04-01', endDate: '2026-05-15', progress: 100, image: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=800&h=600&fit=crop&q=80' },
  { id: 'form-4', centreId: 'centre-3', title: 'Marketing Digital', price: 349, duration: '4 semaines', category: 'Marketing', categorie: 'data-bi', status: 'pending', offreStage: true, entreprisesPartenaires: ['Coca-Cola'], startDate: '2026-08-01', endDate: '2026-08-29', progress: 10, image: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&h=600&fit=crop&q=80' },
  { id: 'form-5', centreId: 'centre-1', title: 'Data Science Basics', price: 599, duration: '8 semaines', category: 'Data', categorie: 'data-bi', status: 'confirmed', offreStage: true, entreprisesPartenaires: ['DataLab'], startDate: '2026-09-01', endDate: '2026-10-24', progress: 20, image: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&h=600&fit=crop&q=80' },
  { id: 'form-6', centreId: 'centre-3', title: 'Gestion Agile', price: 299, duration: '3 semaines', category: 'Management', categorie: 'langues', status: 'confirmed', offreStage: false, entreprisesPartenaires: [], startDate: '2026-07-25', endDate: '2026-08-15', progress: 40, image: 'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=800&h=600&fit=crop&q=80' },
  { id: 'form-7', centreId: 'centre-2', title: 'Photoshop Pro', price: 379, duration: '4 semaines', category: 'Design', categorie: 'data-bi', status: 'in-progress', offreStage: true, entreprisesPartenaires: ['Adobe'], startDate: '2026-06-15', endDate: '2026-07-15', progress: 75, image: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800&h=600&fit=crop&q=80' },
  { id: 'form-8', centreId: 'centre-1', title: 'Python pour Data', price: 629, duration: '8 semaines', category: 'Data', categorie: 'python', status: 'confirmed', offreStage: true, entreprisesPartenaires: ['Orange'], startDate: '2026-08-10', endDate: '2026-09-30', progress: 15, image: 'https://images.unsplash.com/photo-1526379095098-d400fd0bf935?w=800&h=600&fit=crop&q=80' },
];

const centreNamesByMockId = {
  'centre-1': 'Tech Academy Tunis',
  'centre-2': 'Digital Design Institute',
  'centre-3': 'Business Skills Center',
};

const toFormationDocument = (formation, centreId) => ({
  centre: centreId,
  title: formation.title,
  description: '',
  price: Number(formation.price),
  duration: formation.duration,
  category: formation.category,
  categorie: formation.categorie,
  status: formation.status,
  offreStage: Boolean(formation.offreStage),
  entreprisesPartenaires: formation.entreprisesPartenaires,
  startDate: formation.startDate,
  endDate: formation.endDate,
  progress: Number(formation.progress),
  image: formation.image,
});

const validateSource = () => {
  const validStatuses = new Set(['pending', 'confirmed', 'in-progress', 'completed']);
  const invalid = [];

  sourceFormations.forEach((formation) => {
    if (!formation.title || !formation.duration || !Number.isFinite(formation.price) || !validStatuses.has(formation.status)) {
      invalid.push(`${formation.id}: required field, price, duration, or status is invalid`);
    }
    if (formation.startDate && formation.endDate && new Date(formation.endDate) < new Date(formation.startDate)) {
      invalid.push(`${formation.id}: endDate precedes startDate`);
    }
  });

  return invalid;
};

const seedFormations = async () => {
  const invalid = validateSource();
  console.log(`Formations trouvées dans la source: ${sourceFormations.length}`);
  console.log(`Formations transformables: ${sourceFormations.length - invalid.length}`);
  console.log(`Formations invalides: ${invalid.length}`);
  invalid.forEach((reason) => console.error(`- ${reason}`));
  if (invalid.length) throw new Error('La migration est arrêtée: données invalides.');

  await connectToMongoDB();
  const centres = await Centre.find({ name: { $in: Object.values(centreNamesByMockId) } }).select('_id name').lean();
  const centresByName = new Map(centres.map((centre) => [centre.name, centre._id]));
  const unresolved = [...new Set(sourceFormations.map((formation) => formation.centreId))]
    .filter((mockId) => !centresByName.has(centreNamesByMockId[mockId]));

  const resolvedCentreCount = Object.keys(centreNamesByMockId).length - unresolved.length;
  console.log(`Centres résolus: ${resolvedCentreCount} référence(s) centre`);
  console.log(`Références centre non résolues: ${unresolved.length}`);
  unresolved.forEach((mockId) => console.error(`- ${mockId} -> ${centreNamesByMockId[mockId]}`));
  if (unresolved.length) {
    throw new Error('Migration bloquée: aucun ObjectId réel ne correspond à toutes les références centre.');
  }

  let inserted = 0;
  let alreadyPresent = 0;
  for (const source of sourceFormations) {
    const centreId = centresByName.get(centreNamesByMockId[source.centreId]);
    const document = toFormationDocument(source, centreId);
    const existing = await Formation.findOne({ centre: centreId, title: source.title }).select('_id').lean();
    if (existing) {
      alreadyPresent += 1;
      continue;
    }
    await Formation.create(document);
    inserted += 1;
  }

  const importedCount = await Formation.countDocuments({
    title: { $in: sourceFormations.map((formation) => formation.title) },
  });
  console.log(`Formations insérées: ${inserted}`);
  console.log(`Formations déjà présentes: ${alreadyPresent}`);
  console.log(`Formations importées présentes après migration: ${importedCount}`);
};

seedFormations()
  .catch((error) => {
    console.error(`Migration formations non exécutée: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState) await mongoose.disconnect();
  });
