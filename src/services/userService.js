const User = require('../models/User');
const notificationService = require('./notificationService');

const sanitizeUser = (user) => {
  if (!user) return null;
  const userObj = user.toObject ? user.toObject() : { ...user };
  delete userObj.password;
  delete userObj.__v;
  return userObj;
};

const buildUserQuery = (query = {}) => {
  const { search, role, status } = query;
  const filter = {};

  if (search) {
    const regex = new RegExp(search, 'i');
    filter.$or = [
      { nom: regex },
      { prenom: regex },
      { email: regex },
    ];
  }

  if (role) {
    filter.role = role;
  }

  if (status) {
    filter.status = status;
  }

  return filter;
};

const listUsers = async ({ page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc', search, role, status } = {}) => {
  const normalizedLimit = Math.max(1, Number(limit));
  const normalizedPage = Math.max(1, Number(page));
  const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

  const filter = buildUserQuery({ search, role, status });

  const total = await User.countDocuments(filter);
  const users = await User.find(filter)
    .sort(sort)
    .skip((normalizedPage - 1) * normalizedLimit)
    .limit(normalizedLimit)
    .lean();

  return {
    data: users.map(sanitizeUser),
    pagination: {
      page: normalizedPage,
      limit: normalizedLimit,
      total,
      pages: Math.max(1, Math.ceil(total / normalizedLimit)),
    },
  };
};

const findUserById = async (id) => {
  const user = await User.findById(id).lean();
  return sanitizeUser(user);
};

const createUser = async (payload) => {
  const user = await User.create(payload);

  try {
    await notificationService.notifyAdmins(
      'Nouvel utilisateur inscrit',
      `${user.prenom} ${user.nom} vient de créer un compte ${user.role}.`,
      'users'
    );
  } catch (error) {
    // best effort only
  }

  return sanitizeUser(user);
};

const updateUser = async (id, payload) => {
  const user = await User.findByIdAndUpdate(id, payload, {
    new: true,
    runValidators: true,
  }).lean();

  return sanitizeUser(user);
};

const deleteUser = async (id) => {
  const user = await User.findByIdAndUpdate(
    id,
    { status: 'inactive' },
    { new: true, runValidators: true }
  ).lean();

  return sanitizeUser(user);
};

module.exports = {
  listUsers,
  findUserById,
  createUser,
  updateUser,
  deleteUser,
};
