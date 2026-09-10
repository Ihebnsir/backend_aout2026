const request = require('supertest');
const jwt = require('jsonwebtoken');
const { expect } = require('chai');
const app = require('../app');
const User = require('../src/models/User');
const Centre = require('../src/models/Centre');
const { connectTestDatabase, disconnectTestDatabase } = require('./testDatabase');

const sign = (user) => jwt.sign(
  { id: user._id, role: user.role, email: user.email },
  'test-secret-key',
  { expiresIn: '1h' }
);

describe('Centre public endpoint hardening', function () {
  this.timeout(30000);

  before(async () => {
    await connectTestDatabase();
  });

  after(async function () {
    this.timeout(30000);
    await disconnectTestDatabase();
  });

  it('hides private centre ownership and verification details on public endpoints', async () => {
    const centreUser = await User.create({
      nom: 'Centre',
      prenom: 'Public',
      email: 'public.centre@test.com',
      password: 'Password123!',
      role: 'centre',
      status: 'active',
    });

    const centre = await Centre.create({
      userId: centreUser._id,
      name: 'Centre visible public',
      email: 'contact@centre-public.test',
      statutVerification: 'VERIFIE',
      verifie: true,
      dateDemande: new Date(),
      dateValidation: new Date(),
      motifRejet: 'Ancien rejet',
    });

    const listResponse = await request(app).get('/api/centres?page=1&limit=10');
    expect(listResponse.status).to.equal(200);
    const publicCentre = listResponse.body.data.find((item) => item._id.toString() === centre._id.toString());
    expect(publicCentre).to.exist;
    expect(publicCentre).to.not.have.property('userId');
    expect(publicCentre).to.not.have.property('dateDemande');
    expect(publicCentre).to.not.have.property('dateValidation');
    expect(publicCentre).to.not.have.property('motifRejet');

    const detailResponse = await request(app).get(`/api/centres/${centre._id}`);
    expect(detailResponse.status).to.equal(200);
    expect(detailResponse.body.data).to.not.have.property('userId');
    expect(detailResponse.body.data).to.not.have.property('dateDemande');
    expect(detailResponse.body.data).to.not.have.property('dateValidation');
    expect(detailResponse.body.data).to.not.have.property('motifRejet');
    expect(detailResponse.body.data).to.have.property('name', 'Centre visible public');
  });

  it('still exposes the full centre record to the owning centre account', async () => {
    const centreUser = await User.create({
      nom: 'Owner',
      prenom: 'Centre',
      email: 'owner.centre@test.com',
      password: 'Password123!',
      role: 'centre',
      status: 'active',
    });
    const centre = await Centre.create({
      userId: centreUser._id,
      name: 'Private Centre Profile',
      email: 'private@centre.test',
      statutVerification: 'EN_ATTENTE',
      verifie: false,
      dateDemande: new Date(),
    });

    const token = sign(centreUser);
    const response = await request(app)
      .get('/api/centres/me')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).to.equal(200);
    expect(response.body.data).to.have.property('_id');
    expect(response.body.data).to.have.property('userId');
    expect(response.body.data).to.have.property('dateDemande');
  });
});
