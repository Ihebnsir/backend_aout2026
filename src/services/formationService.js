const Formation = require('../models/Formation');
const notificationService = require('./notificationService');

const sanitizeFormation = (formation) => {
  if (!formation) return null;
  const result = formation.toObject ? formation.toObject() : { ...formation };
  delete result.__v;
  return result;
};

const createFormation = async (payload, centreId) => {
  const formation = await Formation.create({
    ...payload,
    centre: centreId,
  }).then((f) => f.populate('centre'));

  try {
    await notificationService.notifyAdmins(
      'Nouvelle formation créée',
      `La formation "${formation.title}" a été créée par le centre associé.`,
      'formations'
    );
  } catch (error) {
    // best effort only
  }

  return sanitizeFormation(formation);
};

const findFormationById = async (id) => {
  const formation = await Formation.findById(id).populate('centre').lean();
  return sanitizeFormation(formation);
};

const listFormations = async ({
  page = 1,
  limit = 10,
  centre,
  category,
  categorie,
  status,
  offreStage,
  search,
} = {}) => {
  const normalizedPage = Math.max(1, Number(page));
  const normalizedLimit = Math.min(100, Math.max(1, Number(limit)));
  const filter = {};

  if (centre) {
    filter.centre = centre;
  }

  if (category) {
    filter.category = new RegExp(category, 'i');
  }

  if (categorie) {
    filter.categorie = new RegExp(categorie, 'i');
  }

  if (status) {
    filter.status = status;
  }

  if (offreStage !== undefined) {
    filter.offreStage = offreStage === 'true' || offreStage === true;
  }

  if (search) {
    filter.$or = [
      { title: new RegExp(search, 'i') },
      { description: new RegExp(search, 'i') },
      { category: new RegExp(search, 'i') },
    ];
  }

  const total = await Formation.countDocuments(filter);
  const formations = await Formation.find(filter)
    .populate('centre')
    .sort({ createdAt: -1 })
    .skip((normalizedPage - 1) * normalizedLimit)
    .limit(normalizedLimit)
    .lean();

  return {
    data: formations.map(sanitizeFormation),
    pagination: {
      page: normalizedPage,
      limit: normalizedLimit,
      total,
      pages: Math.max(1, Math.ceil(total / normalizedLimit)),
    },
  };
};

const updateFormation = async (id, payload) => {
  const forbiddenFields = ['centre', 'createdAt', 'updatedAt'];
  forbiddenFields.forEach((field) => delete payload[field]);

  const formation = await Formation.findByIdAndUpdate(id, payload, {
    new: true,
    runValidators: true,
  }).populate('centre');

  return sanitizeFormation(formation);
};

const deleteFormation = async (id) => {
  const formation = await Formation.findByIdAndDelete(id).lean();
  return sanitizeFormation(formation);
};

module.exports = {
  createFormation,
  findFormationById,
  listFormations,
  updateFormation,
  deleteFormation,
};
