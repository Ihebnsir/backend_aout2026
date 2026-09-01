const request = require('supertest');
const jwt = require('jsonwebtoken');
const { expect } = require('chai');
const app = require('../app');
const User = require('../src/models/User');
const { connectTestDatabase, disconnectTestDatabase } = require('./testDatabase');

let adminToken;
let learnerToken;
let centreToken;

before(async function () {
  this.timeout(30000);

  await connectTestDatabase();
  const users = await User.create([
    {
      nom: 'Admin',
      prenom: 'Dashboard',
      email: 'dashboard.admin@test.com',
      password: 'Password123!',
      telephone: '0600000010',
      role: 'admin',
      status: 'active',
    },
    {
      nom: 'Learner',
      prenom: 'Dashboard',
      email: 'dashboard.learner@test.com',
      password: 'Password123!',
      telephone: '0600000011',
      role: 'apprenant',
      status: 'active',
    },
    {
      nom: 'Centre',
      prenom: 'Dashboard',
      email: 'dashboard.centre@test.com',
      password: 'Password123!',
      telephone: '0600000012',
      role: 'centre',
      status: 'active',
    },
  ]);

  const sign = (user) => jwt.sign({ id: user._id, role: user.role, email: user.email }, 'test-secret-key', { expiresIn: '1h' });
  adminToken = sign(users[0]);
  learnerToken = sign(users[1]);
  centreToken = sign(users[2]);
});

after(async function () {
  this.timeout(30000);
  await disconnectTestDatabase();
});

describe('Admin dashboard API', () => {
  const endpoints = [
    '/api/admin/dashboard/overview',
    '/api/admin/dashboard/growth?period=month&months=6',
    '/api/admin/dashboard/revenue?period=month&months=3',
    '/api/admin/dashboard/repartition/reservations',
    '/api/admin/dashboard/repartition/formations',
    '/api/admin/dashboard/repartition/centres',
    '/api/admin/dashboard/top/centres?limit=3',
    '/api/admin/dashboard/top/formations?limit=3',
    '/api/admin/dashboard/activite-recente?limit=10',
    '/api/admin/dashboard/litiges-stats',
    '/api/admin/dashboard/signalements-stats',
  ];

  it('should protect every dashboard endpoint', async () => {
    for (const endpoint of endpoints) {
      const unauthenticated = await request(app).get(endpoint);
      expect(unauthenticated.status, endpoint).to.equal(401);

      const learner = await request(app).get(endpoint).set('Authorization', `Bearer ${learnerToken}`);
      expect(learner.status, endpoint).to.equal(403);

      const centre = await request(app).get(endpoint).set('Authorization', `Bearer ${centreToken}`);
      expect(centre.status, endpoint).to.equal(403);
    }
  });

  it('should serve every dashboard endpoint to an admin with empty collections', async () => {
    for (const endpoint of endpoints) {
      const response = await request(app).get(endpoint).set('Authorization', `Bearer ${adminToken}`);
      expect(response.status, endpoint).to.equal(200);
      expect(response.body.success, endpoint).to.equal(true);
    }
  });

  it('should return complete month and week series including the current period', async () => {
    const monthResponse = await request(app)
      .get('/api/admin/dashboard/growth?period=month&months=6')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(monthResponse.body.data.series).to.have.length(6);
    expect(monthResponse.body.data.series.every((item) => Number.isInteger(item.apprenants) && item.apprenants >= 0)).to.equal(true);
    expect(monthResponse.body.data.series.every((item) => Number.isInteger(item.centres) && item.centres >= 0)).to.equal(true);

    const weekResponse = await request(app)
      .get('/api/admin/dashboard/revenue?period=week&months=4')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(weekResponse.status).to.equal(200);
    expect(weekResponse.body.data.series).to.have.length(4);
    expect(weekResponse.body.data.series.every((item) => /^\d{4}-W\d{2}$/.test(item.label))).to.equal(true);
  });

  it('should reject invalid dashboard parameters', async () => {
    const invalidRequests = [
      '/api/admin/dashboard/growth?months=99',
      '/api/admin/dashboard/revenue?period=invalid',
      '/api/admin/dashboard/top/centres?limit=0',
      '/api/admin/dashboard/activite-recente?limit=0',
    ];

    for (const endpoint of invalidRequests) {
      const response = await request(app).get(endpoint).set('Authorization', `Bearer ${adminToken}`);
      expect(response.status, endpoint).to.equal(400);
    }
  });
});
