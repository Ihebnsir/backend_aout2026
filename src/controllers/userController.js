const createError = require('http-errors');
const mongoose = require('mongoose');
const User = require('../models/User');
const userService = require('../services/userService');

const getAllUsers = async (req, res, next) => {
  try {
    const { page, limit, sortBy, sortOrder, search, role, status } = req.query;
    const result = await userService.listUsers({ page, limit, sortBy, sortOrder, search, role, status });

    return res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    return next(error);
  }
};

const getUserById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw createError(400, 'ID utilisateur invalide');
    }

    const user = await userService.findUserById(id);

    if (!user) {
      throw createError(404, 'Utilisateur introuvable');
    }

    return res.status(200).json({ success: true, data: user });
  } catch (error) {
    return next(error);
  }
};

const createUser = async (req, res, next) => {
  try {
    const { role, status, permissions, ...rest } = req.body;
    const isAdminRequest = req.user && req.user.role === 'admin';

    const payload = {
      ...rest,
      role: isAdminRequest ? (role || 'apprenant') : 'apprenant',
      status: isAdminRequest && status ? status : 'active',
      permissions: isAdminRequest && Array.isArray(permissions) ? permissions : [],
    };

    const existingUser = await User.findOne({ email: payload.email });
    if (existingUser) {
      throw createError(409, 'Cet email est déjà utilisé');
    }

    if (!payload.password) {
      throw createError(400, 'Le mot de passe est obligatoire');
    }

    const user = await userService.createUser(payload);

    return res.status(201).json({
      success: true,
      message: 'Utilisateur créé avec succès',
      data: user,
    });
  } catch (error) {
    if (error.code === 11000) {
      return next(createError(409, 'Cet email est déjà utilisé'));
    }

    return next(error);
  }
};

const updateUser = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw createError(400, 'ID utilisateur invalide');
    }

    const existingUser = await User.findById(id);
    if (!existingUser) {
      throw createError(404, 'Utilisateur introuvable');
    }

    const { role, status, permissions, ...rest } = req.body;
    const isAdmin = req.user && req.user.role === 'admin';

    if (!isAdmin && (role || status || permissions)) {
      throw createError(403, 'Vous ne pouvez pas modifier ce champ');
    }

    const payload = { ...rest };

    const isEmailChange = payload.email && payload.email.toLowerCase() !== existingUser.email.toLowerCase();
    if (isEmailChange) {
      const emailTaken = await User.findOne({ email: payload.email, _id: { $ne: id } });
      if (emailTaken) {
        throw createError(409, 'Cet email est déjà utilisé');
      }
    }

    if (isAdmin && role) payload.role = role;
    if (isAdmin && status) payload.status = status;
    if (isAdmin && permissions) payload.permissions = permissions;

    const updatedUser = await userService.updateUser(id, payload);

    return res.status(200).json({
      success: true,
      message: 'Utilisateur mis à jour avec succès',
      data: updatedUser,
    });
  } catch (error) {
    if (error.code === 11000) {
      return next(createError(409, 'Cet email est déjà utilisé'));
    }

    return next(error);
  }
};

const deleteUser = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw createError(400, 'ID utilisateur invalide');
    }

    const user = await User.findById(id);
    if (!user) {
      throw createError(404, 'Utilisateur introuvable');
    }

    const deletedUser = await userService.deleteUser(id);

    return res.status(200).json({
      success: true,
      message: 'Utilisateur désactivé avec succès',
      data: deletedUser,
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
};
