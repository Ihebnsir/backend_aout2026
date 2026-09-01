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

const createLitigeRules = [
  body('titre')
    .notEmpty()
    .withMessage('titre est obligatoire')
    .isLength({ max: 200 })
    .withMessage('titre ne doit pas dépasser 200 caractères'),

  body('description')
    .notEmpty()
    .withMessage('description est obligatoire')
    .isLength({ max: 5000 })
    .withMessage('description ne doit pas dépasser 5000 caractères'),

  body('categorie')
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

  body('etudiant')
    .notEmpty()
    .withMessage('etudiant est obligatoire')
    .isMongoId()
    .withMessage('etudiant doit être un ObjectId valide'),

  body('centre')
    .notEmpty()
    .withMessage('centre est obligatoire')
    .isMongoId()
    .withMessage('centre doit être un ObjectId valide'),

  body('formation')
    .optional()
    .isMongoId()
    .withMessage('formation doit être un ObjectId valide'),

  body('reservation')
    .optional()
    .isMongoId()
    .withMessage('reservation doit être un ObjectId valide'),

  // Interdire les champs immuables
  body('numeroDossier')
    .custom((value) => {
      if (value !== undefined) {
        throw new Error('Vous ne pouvez pas définir numeroDossier');
      }
      return true;
    })
    .optional(),

  body('historique')
    .custom((value) => {
      if (value !== undefined) {
        throw new Error('Vous ne pouvez pas définir historique');
      }
      return true;
    })
    .optional(),
];

const updateLitigeStatusRules = [
  param('id')
    .isMongoId()
    .withMessage('ID invalide'),

  body('statut')
    .isIn(['ouvert', 'analyse', 'attente_justificatifs', 'en_cours', 'decision', 'resolu', 'archive'])
    .withMessage('statut invalide'),
];

const assignerResponsableRules = [
  param('id')
    .isMongoId()
    .withMessage('ID invalide'),

  body('responsableId')
    .notEmpty()
    .withMessage('responsableId est obligatoire')
    .isMongoId()
    .withMessage('responsableId doit être un ObjectId valide'),
];

const ajouterMessageRules = [
  param('id')
    .isMongoId()
    .withMessage('ID invalide'),

  body('message')
    .notEmpty()
    .withMessage('message est obligatoire')
    .isLength({ max: 5000 })
    .withMessage('message ne doit pas dépasser 5000 caractères'),
];

const ajouterNoteRules = [
  param('id')
    .isMongoId()
    .withMessage('ID invalide'),

  body('contenu')
    .notEmpty()
    .withMessage('contenu est obligatoire')
    .isLength({ max: 5000 })
    .withMessage('contenu ne doit pas dépasser 5000 caractères'),
];

const ajouterPieceJointeRules = [
  param('id').isMongoId().withMessage('ID invalide'),
  body('nom').trim().notEmpty().withMessage('nom est obligatoire').isLength({ max: 255 }),
  body('type').trim().notEmpty().withMessage('type est obligatoire').isLength({ max: 100 }),
  body('url').trim().notEmpty().withMessage('url est obligatoire').isLength({ max: 2000 }),
  body('taille').optional().isLength({ max: 50 }).withMessage('taille invalide'),
];

const cloturerLitigeRules = [
  param('id')
    .isMongoId()
    .withMessage('ID invalide'),

  body('decisionFinale')
    .notEmpty()
    .withMessage('decisionFinale est obligatoire')
    .isLength({ max: 2000 })
    .withMessage('decisionFinale ne doit pas dépasser 2000 caractères'),
];

const listLitigesRules = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('page doit être >= 1'),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('limit doit être entre 1 et 100'),

  query('statut')
    .optional()
    .isIn(['ouvert', 'analyse', 'attente_justificatifs', 'en_cours', 'decision', 'resolu', 'archive'])
    .withMessage('statut invalide'),

  query('priorite')
    .optional()
    .isIn(['basse', 'moyenne', 'haute', 'critique'])
    .withMessage('priorite invalide'),

  query('categorie')
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
];

module.exports = {
  validateRequest,
  createLitigeRules,
  updateLitigeStatusRules,
  assignerResponsableRules,
  ajouterMessageRules,
  ajouterNoteRules,
  ajouterPieceJointeRules,
  cloturerLitigeRules,
  listLitigesRules,
};
