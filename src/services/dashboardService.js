const User = require('../models/User');
const Centre = require('../models/Centre');
const Formation = require('../models/Formation');
const Reservation = require('../models/Reservation');
const Litige = require('../models/Litige');
const Signalement = require('../models/Signalement');
const CentreNote = require('../models/CentreNote');
const createError = require('http-errors');

// Helper to get the start and end dates for a period
const getPeriodDates = (periods = 6, period = 'month') => {
  const endDate = new Date();
  const startDate = new Date(endDate);

  if (period === 'month') {
    startDate.setDate(1);
    startDate.setMonth(startDate.getMonth() - (periods - 1));
  } else if (period === 'week') {
    const dayOfWeek = startDate.getDay() || 7;
    startDate.setHours(0, 0, 0, 0);
    startDate.setDate(startDate.getDate() - dayOfWeek + 1 - (periods - 1) * 7);
  }

  return { startDate, endDate };
};

// Helper to generate date labels for series
const generateDateLabels = (periods = 6, period = 'month') => {
  const labels = [];
  const now = new Date();

  for (let i = periods - 1; i >= 0; i--) {
    const date = new Date(now);
    if (period === 'month') {
      date.setMonth(date.getMonth() - i);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      labels.push(`${year}-${month}`);
    } else if (period === 'week') {
      const dayOfWeek = date.getDay() || 7;
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() - dayOfWeek + 1 - i * 7);
      const thursday = new Date(date);
      thursday.setDate(thursday.getDate() + 3);
      const isoYear = thursday.getFullYear();
      const yearStart = new Date(isoYear, 0, 1);
      const week = Math.ceil(((thursday - yearStart) / 86400000 + 1) / 7);
      labels.push(`${isoYear}-W${String(week).padStart(2, '0')}`);
    }
  }

  return labels;
};

const getWeekKeyExpression = (field) => ({
  $concat: [
    { $toString: { $isoWeekYear: field } },
    '-W',
    {
      $cond: [
        { $lt: [{ $isoWeek: field }, 10] },
        '0',
        '',
      ],
    },
    { $toString: { $isoWeek: field } },
  ],
});
const getOverview = async () => {
  try {
    // Run all aggregations in parallel
    const [usersData, centresData, formationsData, reservationsData, revenueData, litigesData, signalementsData, notesData] = await Promise.all([
      // Users stats
      User.aggregate([
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            apprenants: {
              $sum: { $cond: [{ $eq: ['$role', 'apprenant'] }, 1, 0] },
            },
            centres: {
              $sum: { $cond: [{ $eq: ['$role', 'centre'] }, 1, 0] },
            },
            admins: {
              $sum: { $cond: [{ $eq: ['$role', 'admin'] }, 1, 0] },
            },
          },
        },
      ]),

      // Centres stats
      Centre.aggregate([
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            verifies: {
              $sum: { $cond: [{ $eq: ['$statutVerification', 'VERIFIE'] }, 1, 0] },
            },
            enAttente: {
              $sum: { $cond: [{ $eq: ['$statutVerification', 'EN_ATTENTE'] }, 1, 0] },
            },
            rejetes: {
              $sum: { $cond: [{ $eq: ['$statutVerification', 'REJETE'] }, 1, 0] },
            },
            suspendus: {
              $sum: { $cond: [{ $eq: ['$statutVerification', 'SUSPENDU'] }, 1, 0] },
            },
          },
        },
      ]),

      // Formations stats
      Formation.aggregate([
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            actives: {
              $sum: { $cond: [{ $eq: ['$status', 'confirmed'] }, 1, 0] },
            },
          },
        },
      ]),

      // Reservations stats
      Reservation.aggregate([
        {
          $facet: {
            stats: [
              {
                $group: {
                  _id: null,
                  total: { $sum: 1 },
                  confirmees: {
                    $sum: { $cond: [{ $eq: ['$status', 'CONFIRMED'] }, 1, 0] },
                  },
                  enCours: { $sum: 0 },
                  terminees: {
                    $sum: { $cond: [{ $eq: ['$status', 'COMPLETED'] }, 1, 0] },
                  },
                  annulees: {
                    $sum: { $cond: [{ $eq: ['$status', 'CANCELLED'] }, 1, 0] },
                  },
                },
              },
            ],
            revenue: [
              {
                $match: { paid: true, price: { $type: 'number' } },
              },
              {
                $group: {
                  _id: null,
                  total: { $sum: '$price' },
                },
              },
            ],
          },
        },
      ]),

      // Revenue this month
      Reservation.aggregate([
        {
          $match: {
            paid: true,
            price: { $type: 'number' },
            paymentDate: {
              $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
              $lt: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1),
            },
          },
        },
        {
          $group: {
            _id: null,
            revenuThisMonth: { $sum: '$price' },
          },
        },
      ]),

      // Litiges stats
      Litige.aggregate([
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            ouverts: {
              $sum: { $cond: [{ $in: ['$statut', ['ouvert', 'analyse', 'attente_justificatifs', 'en_cours', 'decision']] }, 1, 0] },
            },
            resolus: {
              $sum: { $cond: [{ $in: ['$statut', ['resolu', 'archive']] }, 1, 0] },
            },
          },
        },
      ]),

      // Signalements stats
      Signalement.aggregate([
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            enAttente: {
              $sum: { $cond: [{ $eq: ['$status', 'En attente'] }, 1, 0] },
            },
            resolus: {
              $sum: { $cond: [{ $eq: ['$status', 'Résolu'] }, 1, 0] },
            },
          },
        },
      ]),

      // Average satisfaction (notes moyennes)
      CentreNote.aggregate([
        {
          $group: {
            _id: null,
            avgNote: { $avg: '$note' },
          },
        },
      ]),
    ]);

    const users = usersData[0] || { total: 0, apprenants: 0, centres: 0, admins: 0 };
    const centres = centresData[0] || { total: 0, verifies: 0, enAttente: 0, rejetes: 0, suspendus: 0 };
    const formations = formationsData[0] || { total: 0, actives: 0 };
    const reservations = reservationsData[0]?.stats[0] || { total: 0, confirmees: 0, enCours: 0, terminees: 0, annulees: 0 };
    const totalRevenue = reservationsData[0]?.revenue[0]?.total || 0;
    const thisMonthRevenue = revenueData[0]?.revenuThisMonth || 0;
    const litiges = litigesData[0] || { total: 0, ouverts: 0, resolus: 0 };
    const signalements = signalementsData[0] || { total: 0, enAttente: 0, resolus: 0 };
    const notes = notesData[0]?.avgNote || 0;

    // Calculate previous month revenue
    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    const prevMonthRevenue = await Reservation.aggregate([
      {
        $match: {
          paid: true,
          price: { $type: 'number' },
          paymentDate: {
            $gte: new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 1),
            $lt: new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, 1),
          },
        },
      },
      {
        $group: {
          _id: null,
          revenu: { $sum: '$price' },
        },
      },
    ]);

    const prevRevenue = prevMonthRevenue[0]?.revenu || 0;
    const variationPct = prevRevenue !== 0 ? ((thisMonthRevenue - prevRevenue) / prevRevenue) * 100 : 0;

    // Count new users this month
    const firstDayThisMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const newUsersThisMonth = await User.countDocuments({
      createdAt: { $gte: firstDayThisMonth },
    });

    return {
      users: {
        total: users.total,
        apprenants: users.apprenants,
        centres: users.centres,
        admins: users.admins,
        nouveauxCeMois: newUsersThisMonth,
      },
      centres: {
        total: centres.total,
        verifies: centres.verifies,
        enAttente: centres.enAttente,
        rejetes: centres.rejetes,
        suspendus: centres.suspendus,
      },
      formations: {
        total: formations.total,
        actives: formations.actives,
      },
      reservations: {
        total: reservations.total,
        confirmees: reservations.confirmees,
        enCours: reservations.enCours,
        terminees: reservations.terminees,
        annulees: reservations.annulees,
      },
      revenu: {
        total: totalRevenue,
        ceMois: thisMonthRevenue,
        moisPrecedent: prevRevenue,
        variationPct: Math.round(variationPct * 100) / 100,
      },
      litiges: {
        total: litiges.total,
        ouverts: litiges.ouverts,
        resolus: litiges.resolus,
      },
      signalements: {
        total: signalements.total,
        enAttente: signalements.enAttente,
        resolus: signalements.resolus,
      },
      satisfactionMoyenne: Math.round(notes * 10) / 10,
    };
  } catch (error) {
    throw error;
  }
};

const getGrowth = async ({ period = 'month', months = 6 } = {}) => {
  try {
    const labels = generateDateLabels(months, period);
    const { startDate } = getPeriodDates(months, period);

    const data = await User.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: period === 'month' ? '%Y-%m' : '%G-W%V',
              date: '$createdAt',
            },
          },
          apprenants: {
            $sum: { $cond: [{ $eq: ['$role', 'apprenant'] }, 1, 0] },
          },
          centres: {
            $sum: { $cond: [{ $eq: ['$role', 'centre'] }, 1, 0] },
          },
        },
      },
      {
        $sort: { _id: 1 },
      },
    ]);

    // Build a map of existing data
    const dataMap = new Map(data.map((d) => [d._id, d]));

    // Fill missing periods with 0
    const series = labels.map((label) => {
      const existing = dataMap.get(label) || { apprenants: 0, centres: 0 };
      return {
        label,
        apprenants: existing.apprenants || 0,
        centres: existing.centres || 0,
      };
    });

    return { period, series };
  } catch (error) {
    throw error;
  }
};

const getRevenue = async ({ period = 'month', months = 6 } = {}) => {
  try {
    const labels = generateDateLabels(months, period);
    const { startDate } = getPeriodDates(months, period);

    const data = await Reservation.aggregate([
      {
        $match: {
          paid: true,
          paymentDate: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: period === 'month' ? '%Y-%m' : '%G-W%V',
              date: '$paymentDate',
            },
          },
          revenu: { $sum: '$price' },
          nombreTransactions: { $sum: 1 },
        },
      },
      {
        $sort: { _id: 1 },
      },
    ]);

    // Build a map of existing data
    const dataMap = new Map(data.map((d) => [d._id, d]));

    // Fill missing periods with 0
    const series = labels.map((label) => {
      const existing = dataMap.get(label) || { revenu: 0, nombreTransactions: 0 };
      return {
        label,
        revenu: existing.revenu || 0,
        nombreTransactions: existing.nombreTransactions || 0,
      };
    });

    return { period, series };
  } catch (error) {
    throw error;
  }
};

const getRepartitionReservations = async () => {
  try {
    const data = await Reservation.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
      {
        $sort: { _id: 1 },
      },
    ]);

    return data.map((d) => ({ label: d._id, count: d.count }));
  } catch (error) {
    throw error;
  }
};

const getRepartitionFormations = async () => {
  try {
    const data = await Formation.aggregate([
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
        },
      },
      {
        $sort: { _id: 1 },
      },
    ]);

    return data.map((d) => ({ label: d._id || 'Sans catégorie', count: d.count }));
  } catch (error) {
    throw error;
  }
};

const getRepartitionCentres = async () => {
  try {
    const data = await Centre.aggregate([
      {
        $group: {
          _id: '$statutVerification',
          count: { $sum: 1 },
        },
      },
      {
        $sort: { _id: 1 },
      },
    ]);

    return data.map((d) => ({ label: d._id, count: d.count }));
  } catch (error) {
    throw error;
  }
};

const getTopCentres = async ({ limit = 5 } = {}) => {
  try {
    const data = await CentreNote.aggregate([
      {
        $group: {
          _id: '$centre',
          noteMoyenne: { $avg: '$note' },
          nombreAvis: { $sum: 1 },
        },
      },
      {
        $sort: { noteMoyenne: -1 },
      },
      {
        $limit: limit,
      },
      {
        $lookup: {
          from: 'centres',
          localField: '_id',
          foreignField: '_id',
          as: 'centre',
        },
      },
      {
        $unwind: '$centre',
      },
      {
        $project: {
          centre: {
            _id: '$centre._id',
            nom: '$centre.name',
            logo: '$centre.logo',
          },
          noteMoyenne: { $round: ['$noteMoyenne', 1] },
          nombreAvis: 1,
        },
      },
    ]);

    return data;
  } catch (error) {
    throw error;
  }
};

const getTopFormations = async ({ limit = 5 } = {}) => {
  try {
    const data = await Reservation.aggregate([
      {
        $group: {
          _id: '$formationId',
          nombreReservations: { $sum: 1 },
        },
      },
      {
        $sort: { nombreReservations: -1 },
      },
      {
        $limit: limit,
      },
      {
        $lookup: {
          from: 'formations',
          localField: '_id',
          foreignField: '_id',
          as: 'formation',
        },
      },
      {
        $unwind: '$formation',
      },
      {
        $project: {
          formation: {
            _id: '$formation._id',
            titre: '$formation.title',
            categorie: '$formation.category',
          },
          nombreReservations: 1,
        },
      },
    ]);

    return data;
  } catch (error) {
    throw error;
  }
};

const getActiviteRecente = async ({ limit = 20 } = {}) => {
  try {
    const activites = [];

    // Get recent users
    const recentUsers = await User.find()
      .sort({ createdAt: -1 })
      .limit(limit)
      .select('_id nom prenom role createdAt')
      .lean();

    recentUsers.forEach((user) => {
      activites.push({
        type: 'user_inscrit',
        titre: `Nouvel utilisateur inscrit`,
        description: `${user.prenom} ${user.nom} a créé un compte ${user.role}.`,
        date: user.createdAt,
        refId: user._id,
      });
    });

    // Get recent reservations
    const recentReservations = await Reservation.find()
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('learnerId', 'nom prenom')
      .populate('formationId', 'title')
      .select('_id createdAt learnerId formationId')
      .lean();

    recentReservations.forEach((res) => {
      activites.push({
        type: 'reservation_creee',
        titre: 'Nouvelle réservation',
        description: `${res.learnerId ? `${res.learnerId.prenom} ${res.learnerId.nom}` : 'Un apprenant'} a réservé ${res.formationId?.title || 'une formation'}.`,
        date: res.createdAt,
        refId: res._id,
      });
    });

    // Get recent disputes
    const recentLitiges = await Litige.find()
      .sort({ createdAt: -1 })
      .limit(limit)
      .select('_id titre createdAt')
      .lean();

    recentLitiges.forEach((litige) => {
      activites.push({
        type: 'litige_ouvert',
        titre: 'Nouveau litige',
        description: litige.titre,
        date: litige.createdAt,
        refId: litige._id,
      });
    });

    // Get recent reports
    const recentSignalements = await Signalement.find()
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('reporter', 'nom prenom')
      .select('_id type createdAt reporter')
      .lean();

    recentSignalements.forEach((sig) => {
      activites.push({
        type: 'signalement_cree',
        titre: 'Nouveau signalement',
        description: `${sig.reporter ? `${sig.reporter.prenom} ${sig.reporter.nom}` : 'Un utilisateur'} a signalé un problème: ${sig.type}.`,
        date: sig.createdAt,
        refId: sig._id,
      });
    });

    // Get recent centres awaiting validation
    const recentCentresAwait = await Centre.find({ statutVerification: 'EN_ATTENTE' })
      .sort({ dateDemande: -1 })
      .limit(limit)
      .select('_id name dateDemande')
      .lean();

    recentCentresAwait.forEach((centre) => {
      activites.push({
        type: 'centre_en_attente',
        titre: 'Centre en attente de validation',
        description: `${centre.name} attend une validation.`,
        date: centre.dateDemande || new Date(),
        refId: centre._id,
      });
    });

    // Sort by date descending and limit
    return activites.sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, limit);
  } catch (error) {
    throw error;
  }
};

const getLitigesStats = async () => {
  try {
    const [parStatut, parPriorite, tempsResolution] = await Promise.all([
      // By status
      Litige.aggregate([
        {
          $group: {
            _id: '$statut',
            count: { $sum: 1 },
          },
        },
        {
          $sort: { _id: 1 },
        },
      ]),

      // By priority
      Litige.aggregate([
        {
          $group: {
            _id: '$priorite',
            count: { $sum: 1 },
          },
        },
        {
          $sort: { _id: 1 },
        },
      ]),

      // Average resolution time based on the explicit closure history entry.
      Litige.aggregate([
        {
          $match: {
            statut: { $in: ['resolu', 'archive'] },
          },
        },
        {
          $project: {
            createdAt: 1,
            resolutionDate: {
              $max: {
                $map: {
                  input: {
                    $filter: {
                      input: { $ifNull: ['$historique', []] },
                      as: 'entry',
                      cond: { $eq: ['$$entry.action', 'Clôture du dossier'] },
                    },
                  },
                  as: 'entry',
                  in: '$$entry.date',
                },
              },
            },
          },
        },
        {
          $match: { resolutionDate: { $type: 'date' } },
        },
        {
          $group: {
            _id: null,
            tempsResolutionMoyenMs: {
              $avg: { $subtract: ['$resolutionDate', '$createdAt'] },
            },
          },
        },
      ]),
    ]);

    const tempsMs = tempsResolution[0]?.tempsResolutionMoyenMs || 0;
    const tempsJours = Math.round(tempsMs / (1000 * 60 * 60 * 24) * 10) / 10;

    return {
      parStatut: parStatut.map((d) => ({ label: d._id, count: d.count })),
      parPriorite: parPriorite.map((d) => ({ label: d._id, count: d.count })),
      tempsResolutionMoyenJours: tempsJours,
    };
  } catch (error) {
    throw error;
  }
};

const getSignalementsStats = async () => {
  try {
    const [parStatut, parType] = await Promise.all([
      // By status
      Signalement.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
          },
        },
        {
          $sort: { _id: 1 },
        },
      ]),

      // By type
      Signalement.aggregate([
        {
          $group: {
            _id: '$type',
            count: { $sum: 1 },
          },
        },
        {
          $sort: { _id: 1 },
        },
      ]),
    ]);

    return {
      parStatut: parStatut.map((d) => ({ label: d._id, count: d.count })),
      parType: parType.map((d) => ({ label: d._id, count: d.count })),
    };
  } catch (error) {
    throw error;
  }
};

module.exports = {
  getOverview,
  getGrowth,
  getRevenue,
  getRepartitionReservations,
  getRepartitionFormations,
  getRepartitionCentres,
  getTopCentres,
  getTopFormations,
  getActiviteRecente,
  getLitigesStats,
  getSignalementsStats,
};
