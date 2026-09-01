const request = require('supertest');
const { expect } = require('chai');
const app = require('../app');
const User = require('../src/models/User');
const emailService = require('../src/services/emailService');
const { connectTestDatabase, disconnectTestDatabase } = require('./testDatabase');

before(async function () {
  this.timeout(30000);
  await connectTestDatabase();
});

after(async function () {
  this.timeout(30000);
  await disconnectTestDatabase();
});

describe('Email service and registration', () => {
  it('should reject incomplete email payloads without attempting SMTP', async () => {
    try {
      await emailService.sendEmail({ to: 'test@example.com', subject: 'Test' });
      throw new Error('sendEmail should have rejected the incomplete payload');
    } catch (error) {
      expect(error.message).to.equal('Destinataire, sujet et contenu email obligatoires');
    }
  });

  it('should keep a successfully created account when SMTP is unavailable', async () => {
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_PORT;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASSWORD;
    delete process.env.EMAIL_FROM;

    const email = 'welcome.smtp-failure@test.com';
    const response = await request(app)
      .post('/api/auth/register')
      .send({
        nom: 'Welcome',
        prenom: 'Test',
        email,
        password: 'Password123!',
        role: 'apprenant',
      });

    expect(response.status).to.equal(201);
    expect(response.body.success).to.equal(true);
    expect(await User.exists({ email })).to.not.equal(null);
  });

  it('should reject an invalid registration before creating a user or sending email', async () => {
    const email = 'invalid.welcome@test.com';
    const response = await request(app)
      .post('/api/auth/register')
      .send({
        nom: 'Invalid',
        prenom: 'Registration',
        email,
        password: 'short',
        role: 'apprenant',
      });

    expect(response.status).to.equal(400);
    expect(await User.exists({ email })).to.equal(null);
  });
});
