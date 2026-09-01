const { body, validationResult, query, param } = require('express-validator');

const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Données invalides',
      errors: errors.array().map((error) => ({
        field: error.path,
        message: error.msg,
      })),
    });
  }
  return next();
};

const createSignalementRules = [
  body('type')
    .isIn(['Contenu inapproprié', 'Fausse information', 'Spam', 'Harcelement', 'Problème technique'])
    .withMessage('type invalide'),

  body('contenu')
    .notEmpty()
    .withMessage('contenu est obligatoire')
    .isLength({ max: 2000 })
    .withMessage('contenu ne doit pas dépasser 2000 caractères'),

  body('cibleType')
    .optional()
    .isIn(['formation', 'centre', 'commentaire', 'message', 'autre'])
    .withMessage('cibleType invalide')
    .bail()
    .custom((value, { req }) => {
      if (value !== 'autre' && !req.body.cibleId) {
        throw new Error('cibleId est obligatoire lorsque cibleType est renseigné');
      }
      return true;
    }),

  body('cibleId')
    .optional()
    .isMongoId()
    .withMessage('cibleId doit être un ObjectId valide'),
];

const updateSignalementStatusRules = [
  param('id')
    .isMongoId()
    .withMessage('ID invalide'),

  body('status')
    .isIn(['En attente', 'En cours', 'Résolu'])
    .withMessage('status invalide'),

  body('resolutionNote')
    .optional()
    .isLength({ max: 2000 })
    .withMessage('resolutionNote ne doit pas dépasser 2000 caractères'),
];

const escaladerSignalementRules = [
  param('id')
    .isMongoId()
    .withMessage('ID invalide'),

  body('categorie')
    .optional()
    .isIn([
      'Remboursement',
      'Réservation',
      'Certificat',
      'Paiement',
      'Absence formateur',
      'Inscription',
      'Qualité formation',
      'Communication',
      'Retard',
      'Annulation',
    ])
    .withMessage('categorie invalide'),

  body('priorite')
    .optional()
    .isIn(['basse', 'moyenne', 'haute', 'critique'])
    .withMessage('priorite invalide'),

  body('centreId')
    .optional()
    .isMongoId()
    .withMessage('centreId doit être un ObjectId valide'),

  body('formationId')
    .optional()
    .isMongoId()
    .withMessage('formationId doit être un ObjectId valide'),

  body('etudiantId')
    .optional()
    .isMongoId()
    .withMessage('etudiantId doit être un ObjectId valide'),

  body('reservationId')
    .optional()
    .isMongoId()
    .withMessage('reservationId doit être un ObjectId valide'),
];

const listSignalementsRules = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('page doit être >= 1'),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('limit doit être entre 1 et 100'),

  query('type')
    .optional()
    .isIn(['Contenu inapproprié', 'Fausse information', 'Spam', 'Harcelement', 'Problème technique'])
    .withMessage('type invalide'),

  query('status')
    .optional()
    .isIn(['En attente', 'En cours', 'Résolu'])
    .withMessage('status invalide'),
];

module.exports = {
  validateRequest,
  createSignalementRules,
  updateSignalementStatusRules,
  escaladerSignalementRules,
  listSignalementsRules,
};
