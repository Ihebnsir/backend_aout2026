const mongoose = require('mongoose');

const formationSchema = new mongoose.Schema(
  {
    centre: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Centre',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 5000,
      default: '',
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    duration: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    category: {
      type: String,
      trim: true,
      maxlength: 100,
      default: '',
    },
    categorie: {
      type: String,
      trim: true,
      maxlength: 100,
      default: '',
    },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'in-progress', 'completed'],
      default: 'pending',
      index: true,
    },
    offreStage: {
      type: Boolean,
      default: false,
    },
    entreprisesPartenaires: {
      type: [String],
      default: [],
    },
    startDate: {
      type: Date,
      default: null,
    },
    endDate: {
      type: Date,
      default: null,
    },
    progress: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    image: {
      type: String,
      trim: true,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

// Validation personnalisée : endDate >= startDate
formationSchema.pre('save', function(next) {
  if (this.startDate && this.endDate && this.endDate < this.startDate) {
    const err = new Error('endDate doit être supérieur ou égal à startDate');
    return next(err);
  }
  next();
});

// Validation pour update
formationSchema.pre('findOneAndUpdate', function(next) {
  const update = this.getUpdate();
  if (update.$set && update.$set.endDate && update.$set.startDate) {
    if (update.$set.endDate < update.$set.startDate) {
      const err = new Error('endDate doit être supérieur ou égal à startDate');
      return next(err);
    }
  }
  next();
});

module.exports = mongoose.model('Formation', formationSchema);
