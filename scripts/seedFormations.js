require('dotenv').config();

const mongoose = require('mongoose');
const { connectToMongoDB } = require('../config/mongo.connection');
const Centre = require('../src/models/Centre');
const Formation = require('../src/models/Formation');

const formationTemplates = [
  {
    title: 'Développement web avec JavaScript et Node.js',
    description: 'Parcours pratique pour concevoir des applications web modernes, créer une API REST et déployer un projet Node.js.',
    price: 1450,
    duration: '8 semaines - 96 heures',
    category: 'Informatique',
    categorie: 'developpement-web',
    status: 'confirmed',
    offreStage: true,
    entreprisesPartenaires: ['Tek-up', 'Telnet'],
    centreIndex: 0,
  },
  {
    title: 'Administration systèmes Linux',
    description: 'Installation, sécurisation et supervision de serveurs Linux pour les environnements professionnels.',
    price: 1180,
    duration: '6 semaines - 72 heures',
    category: 'Informatique',
    categorie: 'systemes-reseaux',
    status: 'pending',
    offreStage: true,
    entreprisesPartenaires: ['Ooredoo Tunisie'],
    centreIndex: 0,
  },
  {
    title: 'Réseaux Cisco et cybersécurité',
    description: 'Fondamentaux des réseaux, configuration Cisco et bonnes pratiques de protection des infrastructures.',
    price: 1320,
    duration: '7 semaines - 84 heures',
    category: 'Réseaux et sécurité',
    categorie: 'cybersecurite',
    status: 'confirmed',
    offreStage: true,
    entreprisesPartenaires: ['Sofrecom Tunisie'],
    centreIndex: 1,
  },
  {
    title: 'Analyse de données avec Excel avancé',
    description: 'Tableaux croisés dynamiques, fonctions avancées et tableaux de bord pour piloter une activité.',
    price: 690,
    duration: '3 semaines - 36 heures',
    category: 'Bureautique',
    categorie: 'data-analyse',
    status: 'in-progress',
    offreStage: false,
    entreprisesPartenaires: [],
    centreIndex: 1,
  },
  {
    title: 'Python pour la data science',
    description: 'Initiation à Python, NumPy, pandas et à la visualisation de données sur des cas concrets tunisiens.',
    price: 1250,
    duration: '6 semaines - 72 heures',
    category: 'Data et intelligence artificielle',
    categorie: 'data-science',
    status: 'pending',
    offreStage: true,
    entreprisesPartenaires: ['Primatec Engineering'],
    centreIndex: 2,
  },
  {
    title: 'Comptabilité pratique et gestion financière',
    description: 'Maîtriser les opérations comptables courantes, le suivi de trésorerie et les indicateurs financiers.',
    price: 820,
    duration: '4 semaines - 48 heures',
    category: 'Gestion',
    categorie: 'comptabilite',
    status: 'confirmed',
    offreStage: false,
    entreprisesPartenaires: [],
    centreIndex: 2,
  },
  {
    title: 'Marketing digital et réseaux sociaux',
    description: 'Construire une stratégie digitale, créer un calendrier éditorial et mesurer la performance des campagnes.',
    price: 760,
    duration: '4 semaines - 48 heures',
    category: 'Marketing',
    categorie: 'marketing-digital',
    status: 'pending',
    offreStage: true,
    entreprisesPartenaires: ['Tunisie Telecom'],
    centreIndex: 3,
  },
  {
    title: 'Gestion de projet avec les méthodes agiles',
    description: 'Organiser un projet, animer un sprint et suivre les livrables avec Scrum et les outils collaboratifs.',
    price: 900,
    duration: '5 semaines - 60 heures',
    category: 'Management',
    categorie: 'gestion-de-projet',
    status: 'confirmed',
    offreStage: false,
    entreprisesPartenaires: ['Novation City'],
    centreIndex: 3,
  },
  {
    title: 'Français professionnel et communication',
    description: 'Améliorer ses écrits professionnels, ses présentations et sa communication dans un contexte d’entreprise.',
    price: 540,
    duration: '5 semaines - 50 heures',
    category: 'Langues',
    categorie: 'francais-professionnel',
    status: 'in-progress',
    offreStage: false,
    entreprisesPartenaires: [],
    centreIndex: 4,
  },
  {
    title: 'UI/UX design et prototypage Figma',
    description: 'Concevoir une interface accessible, prototyper un parcours utilisateur et tester ses choix de design.',
    price: 980,
    duration: '5 semaines - 60 heures',
    category: 'Design',
    categorie: 'ui-ux-design',
    status: 'pending',
    offreStage: true,
    entreprisesPartenaires: ['Wevioo'],
    centreIndex: 4,
  },
  {
    title: 'Entrepreneuriat et création d’entreprise',
    description: 'Transformer une idée en projet viable grâce au business model, à l’étude de marché et au plan financier.',
    price: 640,
    duration: '3 semaines - 30 heures',
    category: 'Entrepreneuriat',
    categorie: 'creation-entreprise',
    status: 'completed',
    offreStage: false,
    entreprisesPartenaires: [],
    centreIndex: 4,
  },
  {
    title: 'Préparation à l’emploi et techniques d’entretien',
    description: 'Préparer un CV ciblé, valoriser ses compétences et réussir ses entretiens de recrutement.',
    price: 420,
    duration: '2 semaines - 20 heures',
    category: 'Développement professionnel',
    categorie: 'employabilite',
    status: 'confirmed',
    offreStage: false,
    entreprisesPartenaires: [],
    centreIndex: 3,
  },
];

const seedFormations = async () => {
  await connectToMongoDB();

  const centres = await Centre.find({}, { _id: 1, name: 1, ville: 1, domaine: 1 })
    .sort({ name: 1, ville: 1, _id: 1 })
    .lean();

  if (centres.length === 0) {
    throw new Error('Aucun centre réel trouvé : aucune formation ne sera créée.');
  }

  const formations = formationTemplates.map(({ centreIndex, ...formation }) => {
    const centre = centres[centreIndex % centres.length];
    return { ...formation, centre: centre._id };
  });

  const before = await Formation.countDocuments();
  const operations = formations.map((formation) => ({
    updateOne: {
      filter: { centre: formation.centre, title: formation.title },
      update: { $setOnInsert: formation },
      upsert: true,
    },
  }));
  const result = await Formation.bulkWrite(operations, { ordered: true });
  const after = await Formation.countDocuments();

  console.log(`Centres réels trouvés : ${centres.length}`);
  centres.forEach((centre, index) => {
    console.log(`Centre ${index + 1} : ${centre.name} (${centre.ville}) - ${centre._id}`);
  });
  console.log(`Formations avant : ${before}`);
  console.log(`Formations insérées : ${result.upsertedCount}`);
  console.log(`Formations après : ${after}`);
  console.log('Clé d’idempotence : (centre, title)');
  console.log('Aucun mock centre ID utilisé.');
};

seedFormations()
  .catch((error) => {
    console.error('Erreur lors du seed des formations :', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState) {
      await mongoose.disconnect();
    }
  });