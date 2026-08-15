const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../app');

let mongoServer;
let token;
let createdUserId;

before(async () => {
  mongoServer = await MongoMemoryServer.create();
  process.env.MONGO_URL = mongoServer.getUri();
  const { connectToMongoDB } = require('../config/mongo.connection');
  await connectToMongoDB();

  const User = require('../src/models/User');
  await User.deleteMany({});

  const admin = await User.create({
    nom: 'Admin',
    prenom: 'Test',
    email: 'admin@test.com',
    password: 'Password123!',
    telephone: '0600000000',
    role: 'admin',
    status: 'active'
  });

  const jwt = require('jsonwebtoken');
  token = jwt.sign({ id: admin._id, role: admin.role }, 'test-secret-key', { expiresIn: '1h' });
});

after(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('User CRUD API', () => {
  it('POST /api/auth/login should return a JWT and user without password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'admin@test.com',
        password: 'Password123!'
      });

    res.status.should.equal(200);
    res.body.success.should.equal(true);
    res.body.data.user.email.should.equal('admin@test.com');
    should.not.exist(res.body.data.user.password);
    should.exist(res.body.data.token);
    token = res.body.data.token;
  });

  it('GET /api/users should require admin', async () => {
    const res = await request(app).get('/api/users');
    expect(res.status).to.equal(401);
  });

  it('POST /api/users should create a user and hide password', async () => {
    const res = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${token}`)
      .send({
        nom: 'Alice',
        prenom: 'Martin',
        email: 'alice@example.com',
        password: 'Password123!',
        telephone: '0700000001',
        role: 'apprenant'
      });

    if (res.status !== 201) {
      console.log(res.body);
    }

    res.status.should.equal(201);
    res.body.success.should.equal(true);
    res.body.data.email.should.equal('alice@example.com');
    should.not.exist(res.body.data.password);
    should.not.exist(res.body.data.passwordHash);
    createdUserId = res.body.data._id || res.body.data.id;
  });

  it('GET /api/users should return paginated list for admin', async () => {
    const res = await request(app)
      .get('/api/users?page=1&limit=10')
      .set('Authorization', `Bearer ${token}`);

    res.status.should.equal(200);
    res.body.success.should.equal(true);
    res.body.data.should.be.an('array');
    res.body.pagination.should.have.property('total');
  });

  it('GET /api/users/:id should return the user without password', async () => {
    const res = await request(app)
      .get(`/api/users/${createdUserId}`)
      .set('Authorization', `Bearer ${token}`);

    res.status.should.equal(200);
    res.body.success.should.equal(true);
    should.not.exist(res.body.data.password);
  });

  it('PATCH /api/users/:id should allow admin to change role when authorized', async () => {
    const res = await request(app)
      .patch(`/api/users/${createdUserId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ nom: 'Alice Updated', role: 'centre' });

    res.status.should.equal(200);
    res.body.success.should.equal(true);
    res.body.data.role.should.equal('centre');
  });

  it('DELETE /api/users/:id should deactivate instead of deleting', async () => {
    const res = await request(app)
      .delete(`/api/users/${createdUserId}`)
      .set('Authorization', `Bearer ${token}`);

    res.status.should.equal(200);
    res.body.success.should.equal(true);
    res.body.data.status.should.equal('inactive');
  });
});

const should = require('chai').should();
const expect = require('chai').expect;
