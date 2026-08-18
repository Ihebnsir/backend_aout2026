const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    nom: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    prenom: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
      select: false,
    },
    telephone: {
      type: String,
      trim: true,
      default: '',
    },
    ville: {
      type: String,
      trim: true,
      default: '',
    },
    role: {
      type: String,
      enum: ['apprenant', 'centre', 'admin'],
      default: 'apprenant',
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'pending', 'suspended'],
      default: 'active',
    },
    avatar: {
      type: String,
      default: '',
    },
    permissions: {
      type: [String],
      default: [],
    },
    emailVerified: {
      type: Boolean,
      default: false,
    },
    profileVerified: {
      type: Boolean,
      default: false,
    },
    lastLoginAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

userSchema.pre('save', async function nextHashPassword() {
  if (!this.isModified('password') || !this.password) {
    return;
  }

  this.password = await bcrypt.hash(this.password, 10);
});

userSchema.pre('findOneAndUpdate', async function nextHashPassword() {
  const update = this.getUpdate();

  if (!update) {
    return;
  }

  let passwordValue = null;

  if (update.password) {
    passwordValue = update.password;
  } else if (update.$set && update.$set.password) {
    passwordValue = update.$set.password;
  }

  if (!passwordValue) {
    return;
  }

  const hashedPassword = await bcrypt.hash(passwordValue, 10);

  if (update.$set) {
    update.$set.password = hashedPassword;
    return;
  }

  update.password = hashedPassword;
});

userSchema.methods.comparePassword = async function comparePassword(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.password;
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('User', userSchema);
