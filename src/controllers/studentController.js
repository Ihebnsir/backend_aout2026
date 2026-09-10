const createError = require('http-errors');
const centreService = require('../services/centreService');
const studentService = require('../services/studentService');

const getMyStudents = async (req, res, next) => {
  try {
    const centre = await centreService.findCentreByUserId(req.user.id);
    if (!centre) throw createError(404, 'Aucun centre associé');
    const result = await studentService.getStudentsForCentre(centre._id, req.query);
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    return next(error);
  }
};

module.exports = { getMyStudents };
