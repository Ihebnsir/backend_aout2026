const request = require('supertest');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { expect } = require('chai');
const app = require('../app');
const User = require('../src/models/User');
const Centre = require('../src/models/Centre');
const CentreDocument = require('../src/models/CentreDocument');
const Notification = require('../src/models/Notification');
const { connectTestDatabase } = require('./testDatabase');

const sign = (user) => jwt.sign(
  { id: user._id, role: user.role, email: user.email },
  'test-secret-key',
  { expiresIn: '1h' }
);

describe('CentreDocument API', function () {
  this.timeout(30000);

  let admin;
  let learner;
  let centreUser;
  let otherCentreUser;
  let centre;
  let otherCentre;
  let adminToken;
  let learnerToken;
  let centreToken;
  let otherCentreToken;

  const createDocument = (overrides = {}) => CentreDocument.create({
    centre: centre._id,
    type: 'registre_commerce',
    fileUrl: 'https://example.com/document.pdf',
    ...overrides,
  });

  before(async () => {
    await connectTestDatabase();
    [admin, learner, centreUser, otherCentreUser] = await User.create([
      { nom: 'Admin', prenom: 'Documents', email: 'documents.admin@test.com', password: 'Password123!', role: 'admin', status: 'active' },
      { nom: 'Learner', prenom: 'Documents', email: 'documents.learner@test.com', password: 'Password123!', role: 'apprenant', status: 'active' },
      { nom: 'Centre', prenom: 'One', email: 'documents.centre.one@test.com', password: 'Password123!', role: 'centre', status: 'active' },
      { nom: 'Centre', prenom: 'Two', email: 'documents.centre.two@test.com', password: 'Password123!', role: 'centre', status: 'active' },
    ]);
    [centre, otherCentre] = await Centre.create([
      { userId: centreUser._id, name: 'Documents Centre One', statutVerification: 'EN_ATTENTE' },
      { userId: otherCentreUser._id, name: 'Documents Centre Two', statutVerification: 'EN_ATTENTE' },
    ]);
    adminToken = sign(admin);
    learnerToken = sign(learner);
    centreToken = sign(centreUser);
    otherCentreToken = sign(otherCentreUser);
  });

  beforeEach(async () => {
    await Promise.all([
      CentreDocument.deleteMany({}),
      Notification.deleteMany({}),
    ]);
    await Centre.updateMany(
      { _id: { $in: [centre._id, otherCentre._id] } },
      { $set: { statutVerification: 'EN_ATTENTE', verifie: false, motifRejet: null } }
    );
  });

  it('enforces authentication and role access', async () => {
    expect((await request(app).get('/api/centre-documents')).status).to.equal(401);
    expect((await request(app).get('/api/centre-documents/admin')).status).to.equal(401);
    expect((await request(app).get('/api/centre-documents').set('Authorization', `Bearer ${learnerToken}`)).status).to.equal(403);
    expect((await request(app).get('/api/centre-documents/admin').set('Authorization', `Bearer ${centreToken}`)).status).to.equal(403);
  });

  it('allows a centre to submit and list only its own documents', async () => {
    const created = await request(app)
      .post('/api/centre-documents')
      .set('Authorization', `Bearer ${centreToken}`)
      .send({ type: 'registre_commerce', fileUrl: 'https://example.com/registre.pdf' });
    expect(created.status).to.equal(201);
    expect(created.body.data.centre.toString()).to.equal(centre._id.toString());

    const list = await request(app)
      .get('/api/centre-documents')
      .set('Authorization', `Bearer ${centreToken}`);
    expect(list.status).to.equal(200);
    expect(list.body.data).to.have.length(1);

    const otherList = await request(app)
      .get('/api/centre-documents')
      .set('Authorization', `Bearer ${otherCentreToken}`);
    expect(otherList.status).to.equal(200);
    expect(otherList.body.data).to.have.length(0);
  });

  it('blocks cross-centre detail and deletion', async () => {
    const document = await createDocument();
    const detail = await request(app)
      .get(`/api/centre-documents/${document._id}`)
      .set('Authorization', `Bearer ${otherCentreToken}`);
    const deletion = await request(app)
      .delete(`/api/centre-documents/${document._id}`)
      .set('Authorization', `Bearer ${otherCentreToken}`);
    expect(detail.status).to.equal(403);
    expect(deletion.status).to.equal(403);
  });

  it('provides an admin queue with pagination and filters', async () => {
    await createDocument({ status: 'en_attente', type: 'registre_commerce' });
    await createDocument({ status: 'valide', type: 'assurance' });
    await CentreDocument.create({
      centre: otherCentre._id,
      type: 'certification',
      fileUrl: 'http://example.com/certification.pdf',
      status: 'refuse',
    });

    const response = await request(app)
      .get(`/api/centre-documents/admin?status=en_attente&type=registre_commerce&centre=${centre._id}&page=1&limit=1`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(response.status).to.equal(200);
    expect(response.body.data).to.have.length(1);
    expect(response.body.data[0].centre.name).to.equal('Documents Centre One');
    expect(response.body.pagination.total).to.equal(1);
    expect(response.body.pagination.limit).to.equal(1);
  });

  it('allows pending documents to be validated or rejected once', async () => {
    const validDocument = await createDocument();
    const validated = await request(app)
      .patch(`/api/centre-documents/${validDocument._id}/validate`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ commentaireAdmin: 'Conforme' });
    expect(validated.status).to.equal(200);
    expect(validated.body.data.status).to.equal('valide');

    const reversed = await request(app)
      .patch(`/api/centre-documents/${validDocument._id}/reject`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ commentaireAdmin: 'Rejet inverse' });
    expect(reversed.status).to.equal(409);

    const rejectedDocument = await createDocument();
    const rejected = await request(app)
      .patch(`/api/centre-documents/${rejectedDocument._id}/reject`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ commentaireAdmin: 'Document incomplet' });
    expect(rejected.status).to.equal(200);
    expect(rejected.body.data.status).to.equal('refuse');

    const revalidated = await request(app)
      .patch(`/api/centre-documents/${rejectedDocument._id}/validate`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ commentaireAdmin: 'Revalidation' });
    expect(revalidated.status).to.equal(409);
  });

  it('requires rejection reason and validates document references', async () => {
    const document = await createDocument();
    const missingReason = await request(app)
      .patch(`/api/centre-documents/${document._id}/reject`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});
    expect(missingReason.status).to.equal(400);

    const orphan = await CentreDocument.create({
      centre: new mongoose.Types.ObjectId(),
      type: 'autre',
      fileUrl: 'https://example.com/orphan.pdf',
    });
    const invalidReference = await request(app)
      .patch(`/api/centre-documents/${orphan._id}/validate`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(invalidReference.status).to.equal(404);
  });

  it('accepts HTTP/HTTPS metadata and rejects unsafe URLs', async () => {
    for (const fileUrl of ['https://example.com/secure.pdf', 'http://example.com/plain.pdf']) {
      const response = await request(app)
        .post('/api/centre-documents')
        .set('Authorization', `Bearer ${centreToken}`)
        .send({ type: 'autre', fileUrl });
      expect(response.status).to.equal(201);
    }

    for (const fileUrl of ['javascript:alert(1)', 'data:text/plain,secret', 'file:///C:/secret.pdf', 'C:\\secret.pdf', 'not-a-url']) {
      const response = await request(app)
        .post('/api/centre-documents')
        .set('Authorization', `Bearer ${centreToken}`)
        .send({ type: 'autre', fileUrl });
      expect(response.status).to.equal(400);
    }
  });

  it('keeps Centre verification status separate from document decisions', async () => {
    const document = await createDocument();
    await request(app)
      .patch(`/api/centre-documents/${document._id}/validate`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});
    let current = await Centre.findById(centre._id).lean();
    expect(current.statutVerification).to.equal('EN_ATTENTE');

    const rejectedDocument = await createDocument();
    await request(app)
      .patch(`/api/centre-documents/${rejectedDocument._id}/reject`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ commentaireAdmin: 'Refus de test' });
    current = await Centre.findById(centre._id).lean();
    expect(current.statutVerification).to.equal('EN_ATTENTE');
  });

  it('creates document notifications without requiring external delivery', async () => {
    const document = await request(app)
      .post('/api/centre-documents')
      .set('Authorization', `Bearer ${centreToken}`)
      .send({ type: 'autre', fileUrl: 'https://example.com/notification.pdf' });
    expect(document.status).to.equal(201);
    expect(await Notification.countDocuments({ category: 'documents', role: 'centre', userId: centreUser._id })).to.equal(1);
    expect(await Notification.countDocuments({ category: 'documents', role: 'admin' })).to.equal(1);

    await request(app)
      .patch(`/api/centre-documents/${document.body.data._id}/validate`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});
    expect(await Notification.countDocuments({ category: 'documents', role: 'centre', userId: centreUser._id })).to.equal(2);

    const rejectedDocument = await createDocument();
    await request(app)
      .patch(`/api/centre-documents/${rejectedDocument._id}/reject`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ commentaireAdmin: 'Motif de test' });
    expect(await Notification.countDocuments({ category: 'documents', role: 'centre', userId: centreUser._id })).to.equal(3);
  });
});
