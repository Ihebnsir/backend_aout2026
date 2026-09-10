const createError = require('http-errors');
const mongoose = require('mongoose');
const attendanceService = require('../services/attendanceService');
const centreService = require('../services/centreService');

const ensureId = (id) => {
  if (!mongoose.Types.ObjectId.isValid(id)) throw createError(400, 'ID invalide');
};

const getAttendance = async (req, res, next) => {
  try {
    if (req.user.role === 'centre') {
      const centre = await centreService.findCentreByUserId(req.user.id);
      if (!centre) throw createError(404, 'Aucun centre associé');
      const result = await attendanceService.listAttendanceForCentre(centre._id, req.query);
      return res.status(200).json({ success: true, ...result });
    }

    if (req.user.role === 'apprenant') {
      const result = await attendanceService.listAttendanceForLearner(req.user.id, req.query);
      return res.status(200).json({ success: true, ...result });
    }

    if (req.user.role === 'admin') {
      const result = await attendanceService.listAttendanceForCentre(req.query.centre || null, req.query);
      return res.status(200).json({ success: true, ...result });
    }

    throw createError(403, 'Accès interdit');
  } catch (error) {
    return next(error);
  }
};

const getMyAttendance = async (req, res, next) => {
  try {
    const result = await attendanceService.listAttendanceForLearner(req.user.id, req.query);
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    return next(error);
  }
};

const getAttendanceById = async (req, res, next) => {
  try {
    ensureId(req.params.id);
    const attendance = await attendanceService.getAttendanceById(req.params.id);
    if (req.user.role !== 'admin' && attendance.learner._id.toString() !== req.user.id.toString()) {
      const centre = await centreService.findCentreByUserId(req.user.id);
      if (!centre || attendance.centre.toString() !== centre._id.toString()) throw createError(403, 'Accès interdit');
    }
    return res.status(200).json({ success: true, data: attendance });
  } catch (error) {
    return next(error);
  }
};

const createAttendance = async (req, res, next) => {
  try {
    const centre = await centreService.findCentreByUserId(req.user.id);
    if (!centre) throw createError(404, 'Aucun centre associé');
    const attendance = await attendanceService.createAttendance(req.body, req.user.id);
    return res.status(201).json({ success: true, message: 'Présence enregistrée', data: attendance });
  } catch (error) {
    return next(error);
  }
};

const updateAttendance = async (req, res, next) => {
  try {
    ensureId(req.params.id);
    const centre = await centreService.findCentreByUserId(req.user.id);
    if (!centre) throw createError(404, 'Aucun centre associé');
    const attendance = await attendanceService.updateAttendance(req.params.id, req.body, centre._id);
    return res.status(200).json({ success: true, message: 'Présence mise à jour', data: attendance });
  } catch (error) {
    return next(error);
  }
};

const getSessionAttendance = async (req, res, next) => {
  try {
    ensureId(req.params.sessionId);
    const centre = await centreService.findCentreByUserId(req.user.id);
    if (!centre) throw createError(404, 'Aucun centre associé');
    const items = await attendanceService.listAttendanceForSession(req.params.sessionId, centre._id);
    return res.status(200).json({ success: true, data: items });
  } catch (error) {
    return next(error);
  }
};

module.exports = { getAttendance, getMyAttendance, getAttendanceById, createAttendance, updateAttendance, getSessionAttendance };
