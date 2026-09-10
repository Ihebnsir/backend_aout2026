const request = require('supertest');
const { expect } = require('chai');
const app = require('../app');
const User = require('../src/models/User');
const PasswordReset = require('../src/models/PasswordReset');
const passwordResetService = require('../src/services/passwordResetService');
const { connectTestDatabase, disconnectTestDatabase } = require('./testDatabase');

const email = 'password-reset@test.com';
let capturedEmail;

before(async function () {
  this.timeout(30000);
  await connectTestDatabase();
  passwordResetService.setEmailSender(async (mail) => {
    capturedEmail = mail;
    return { accepted: [mail.to], rejected: [] };
  });
});

beforeEach(async () => {
  capturedEmail = undefined;
  await PasswordReset.deleteMany({});
  await User.deleteOne({ email });
  await User.create({
    nom: 'Reset',
    prenom: 'Test',
    email,
    password: 'OldPassword123!',
    role: 'apprenant',
    status: 'active',
  });
});

after(async function () {
  passwordResetService.setEmailSender();
  await disconnectTestDatabase();
});

const requestCode = async (targetEmail = email) => {
  const response = await request(app).post('/api/auth/forgot-password').send({ email: targetEmail });
  return response;
};

const getCode = () => capturedEmail.text.match(/code de vérification est : (\d{6})/i)[1];

describe('Password reset API', () => {
  it('returns the same generic response and sends an email for an existing address', async () => {
    const response = await requestCode();

    expect(response.status).to.equal(200);
    expect(response.body).to.deep.equal({
      success: true,
      message: 'Si cette adresse existe, un code de réinitialisation a été envoyé.',
    });
    expect(capturedEmail.to).to.equal(email);
    expect(capturedEmail.text).to.not.include('OldPassword123!');
    expect(response.body).to.not.have.property('code');
  });

  it('does not enumerate unknown addresses', async () => {
    const response = await requestCode('unknown-password-reset@test.com');

    expect(response.status).to.equal(200);
    expect(response.body.message).to.equal('Si cette adresse existe, un code de réinitialisation a été envoyé.');
    expect(capturedEmail).to.equal(undefined);
  });

  it('rejects invalid emails', async () => {
    const response = await requestCode('invalid-email');
    expect(response.status).to.equal(400);
  });

  it('limits excessive reset requests without changing the generic response', async () => {
    await requestCode();
    await requestCode();
    await requestCode();
    capturedEmail = undefined;
    const limited = await requestCode();

    expect(limited.status).to.equal(200);
    expect(capturedEmail).to.equal(undefined);
    expect(await PasswordReset.countDocuments({ email })).to.equal(3);
  });

  it('verifies a correct code and rejects an incorrect code', async () => {
    await requestCode();
    const incorrect = await request(app).post('/api/auth/verify-reset-code').send({ email, code: '000000' });
    expect(incorrect.status).to.equal(400);

    const correct = await request(app).post('/api/auth/verify-reset-code').send({ email, code: getCode() });
    expect(correct.status).to.equal(200);
    expect(correct.body.data.resetToken).to.be.a('string');
    expect(correct.body.data.resetToken).to.not.include(getCode());
  });

  it('rejects an expired code', async () => {
    await requestCode();
    await PasswordReset.updateMany({}, { $set: { expiresAt: new Date(Date.now() - 1000) } });

    const response = await request(app).post('/api/auth/verify-reset-code').send({ email, code: getCode() });
    expect(response.status).to.equal(400);
  });

  it('revokes a code after too many incorrect attempts', async () => {
    await requestCode();

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await request(app).post('/api/auth/verify-reset-code').send({ email, code: '000000' });
      expect(response.status).to.equal(400);
    }

    const response = await request(app).post('/api/auth/verify-reset-code').send({ email, code: getCode() });
    expect(response.status).to.equal(400);
  });

  it('resets the password, allows new login, and prevents reuse', async () => {
    await requestCode();
    const verification = await request(app).post('/api/auth/verify-reset-code').send({ email, code: getCode() });
    const resetToken = verification.body.data.resetToken;
    const reset = await request(app).post('/api/auth/reset-password').send({
      resetToken,
      newPassword: 'NewPassword123!',
      confirmPassword: 'NewPassword123!',
    });

    expect(reset.status).to.equal(200);
    expect(reset.body).to.not.have.property('token');
    expect((await request(app).post('/api/auth/login').send({ email, password: 'NewPassword123!' })).status).to.equal(200);
    expect((await request(app).post('/api/auth/login').send({ email, password: 'OldPassword123!' })).status).to.equal(401);

    const reused = await request(app).post('/api/auth/reset-password').send({
      resetToken,
      newPassword: 'AnotherPassword123!',
      confirmPassword: 'AnotherPassword123!',
    });
    expect(reused.status).to.equal(400);
  });

  it('rejects invalid or weak reset credentials', async () => {
    const invalidToken = await request(app).post('/api/auth/reset-password').send({
      resetToken: 'invalid',
      newPassword: 'short',
      confirmPassword: 'short',
    });
    expect(invalidToken.status).to.equal(400);

    await requestCode();
    const verification = await request(app).post('/api/auth/verify-reset-code').send({ email, code: getCode() });
    const weakPassword = await request(app).post('/api/auth/reset-password').send({
      resetToken: verification.body.data.resetToken,
      newPassword: 'short',
      confirmPassword: 'short',
    });
    expect(weakPassword.status).to.equal(400);
  });

  it('rejects an expired reset authorization token', async () => {
    await requestCode();
    const verification = await request(app).post('/api/auth/verify-reset-code').send({ email, code: getCode() });
    await PasswordReset.updateMany({}, { $set: { expiresAt: new Date(Date.now() - 1000) } });

    const response = await request(app).post('/api/auth/reset-password').send({
      resetToken: verification.body.data.resetToken,
      newPassword: 'NewPassword123!',
      confirmPassword: 'NewPassword123!',
    });
    expect(response.status).to.equal(400);
  });
});