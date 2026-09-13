const fs = require('fs');
const os = require('os');
const path = require('path');
const { expect } = require('chai');
const { S3Client } = require('@aws-sdk/client-s3');
const supabase = require('@supabase/supabase-js');
const Attachment = require('../src/models/Attachment');
const attachmentService = require('../src/services/attachmentService');
const storage = require('../src/services/attachmentStorage');

const originalEnvironment = { ...process.env };
const originalSend = S3Client.prototype.send;
const originalCreateClient = supabase.createClient;

const restoreEnvironment = () => {
  for (const key of Object.keys(process.env)) {
    if (!Object.prototype.hasOwnProperty.call(originalEnvironment, key)) delete process.env[key];
  }
  Object.assign(process.env, originalEnvironment);
};

describe('Attachment storage adapters', () => {
  afterEach(() => {
    restoreEnvironment();
    S3Client.prototype.send = originalSend;
    supabase.createClient = originalCreateClient;
  });

  it('uploads, reads, deletes, and reports missing local files', async () => {
    const storageRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'skillbridge-attachments-'));
    process.env.ATTACHMENT_STORAGE_PROVIDER = 'local';
    process.env.ATTACHMENT_STORAGE_DIR = storageRoot;
    const metadata = await storage.writeAttachmentFile({
      conversationId: 'conversation-1',
      userId: 'user-1',
      originalName: '../report.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('local-content'),
    });

    expect(metadata.provider).to.equal('local');
    expect(metadata.storedName).to.not.include('..');
    expect(await storage.readAttachmentFile(metadata.absolutePath)).to.deep.equal(Buffer.from('local-content'));
    await storage.deleteAttachmentFile(metadata.absolutePath);
    expect(() => fs.accessSync(metadata.absolutePath)).to.throw();
    try {
      await storage.readAttachmentFile(metadata.absolutePath);
      expect.fail('Expected missing local file to be rejected');
    } catch (error) {
      expect(error.status).to.equal(404);
    }
  });

  it('validates R2 configuration without exposing credentials', () => {
    process.env.ATTACHMENT_STORAGE_PROVIDER = 'r2';
    delete process.env.R2_SECRET_ACCESS_KEY;
    expect(() => storage.validateStorageConfig()).to.throw(/R2_SECRET_ACCESS_KEY/);
    process.env.R2_ACCOUNT_ID = 'account';
    process.env.R2_ACCESS_KEY_ID = 'access';
    process.env.R2_SECRET_ACCESS_KEY = 'secret';
    process.env.R2_BUCKET_NAME = 'private-bucket';
    process.env.R2_ENDPOINT = 'https://account.r2.cloudflarestorage.com';
    expect(() => storage.validateStorageConfig()).to.not.throw();
  });

  it('selects Supabase when its complete configuration is present', () => {
    process.env.ATTACHMENT_STORAGE_PROVIDER = 'supabase';
    process.env.SUPABASE_URL = 'https://project.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
    process.env.SUPABASE_STORAGE_BUCKET = 'skillbridge-attachments';

    expect(storage.validateStorageConfig()).to.equal('supabase');
  });

  it('rejects incomplete Supabase configuration without falling back to local', () => {
    process.env.ATTACHMENT_STORAGE_PROVIDER = 'supabase';
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.SUPABASE_STORAGE_BUCKET;

    expect(() => storage.validateStorageConfig()).to.throw(/SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_STORAGE_BUCKET/);
    return storage.writeAttachmentFile({
      conversationId: 'conversation-missing-config',
      userId: 'user-missing-config',
      originalName: 'notes.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('must-not-be-local'),
    }).then(() => expect.fail('Expected incomplete Supabase configuration to reject'))
      .catch((error) => expect(error.message).to.match(/Configuration Supabase incomplète/));
  });

  it('uploads, reads, and deletes private Supabase objects using opaque keys', async () => {
    process.env.ATTACHMENT_STORAGE_PROVIDER = 'supabase';
    process.env.SUPABASE_URL = 'https://project.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
    process.env.SUPABASE_STORAGE_BUCKET = 'skillbridge-attachments';
    const objects = new Map();
    const calls = [];

    supabase.createClient = () => ({
      storage: {
        from: (bucket) => {
          expect(bucket).to.equal('skillbridge-attachments');
          return {
            upload: async (key, buffer, options) => {
              calls.push({ operation: 'upload', key, options });
              objects.set(key, Buffer.from(buffer));
              return { data: { path: key }, error: null };
            },
            download: async (key) => {
              calls.push({ operation: 'download', key });
              return { data: { type: 'text/plain', arrayBuffer: async () => objects.get(key) }, error: null };
            },
            remove: async (keys) => {
              calls.push({ operation: 'remove', keys });
              keys.forEach((key) => objects.delete(key));
              return { data: keys.map((key) => ({ name: key })), error: null };
            },
          };
        },
      },
    });

    const metadata = await storage.writeAttachmentFile({
      conversationId: 'conversation-3',
      userId: 'user-3',
      originalName: 'notes.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('supabase-content'),
    });
    expect(metadata.provider).to.equal('supabase');
    expect(metadata.storageKey).to.match(/^conversations\/conversation-3\/user-3\//);
    expect(metadata.storageKey).to.not.include('notes.txt');
    expect(calls[0].options).to.deep.include({ contentType: 'text/plain', upsert: false });

    expect(await storage.readSupabaseObject(metadata.storageKey)).to.deep.include({
      content: Buffer.from('supabase-content'),
      contentType: 'text/plain',
    });
    await storage.deleteSupabaseObject(metadata.storageKey);
    expect(objects.has(metadata.storageKey)).to.equal(false);
    expect(calls.map((call) => call.operation)).to.deep.equal(['upload', 'download', 'remove']);
  });

  it('uploads, reads, and deletes private R2 objects using opaque keys', async () => {
    process.env.ATTACHMENT_STORAGE_PROVIDER = 'r2';
    process.env.R2_ACCOUNT_ID = 'account';
    process.env.R2_ACCESS_KEY_ID = 'access';
    process.env.R2_SECRET_ACCESS_KEY = 'secret';
    process.env.R2_BUCKET_NAME = 'private-bucket';
    process.env.R2_ENDPOINT = 'https://account.r2.cloudflarestorage.com';
    const objects = new Map();

    S3Client.prototype.send = async (command) => {
      const name = command.constructor.name;
      if (name === 'PutObjectCommand') {
        objects.set(command.input.Key, Buffer.from(command.input.Body));
        return {};
      }
      if (name === 'GetObjectCommand') {
        const value = objects.get(command.input.Key);
        if (!value) {
          const error = new Error('missing');
          error.name = 'NoSuchKey';
          throw error;
        }
        return { Body: { transformToByteArray: async () => value }, ContentType: 'text/plain' };
      }
      if (name === 'DeleteObjectCommand') {
        objects.delete(command.input.Key);
        return {};
      }
      throw new Error(`Unexpected command: ${name}`);
    };

    const metadata = await storage.writeAttachmentFile({
      conversationId: 'conversation-2',
      userId: 'user-2',
      originalName: 'notes.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('r2-content'),
    });
    expect(metadata.provider).to.equal('r2');
    expect(metadata.storageKey).to.match(/^conversations\/conversation-2\/user-2\//);
    expect(metadata.storageKey).to.not.include('notes.txt');
    expect(await storage.readAttachmentObject(metadata.storageKey)).to.deep.include({ contentType: 'text/plain' });
    await storage.deleteAttachmentObject(metadata.storageKey);
    try {
      await storage.readAttachmentObject(metadata.storageKey);
      expect.fail('Expected missing R2 object to be rejected');
    } catch (error) {
      expect(error.status).to.equal(404);
      expect(error.message).to.equal('Fichier introuvable');
    }
  });

  it('cleans up stored content when MongoDB persistence fails', async () => {
    const storageRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'skillbridge-attachments-'));
    process.env.ATTACHMENT_STORAGE_PROVIDER = 'local';
    process.env.ATTACHMENT_STORAGE_DIR = storageRoot;
    const originalCreate = Attachment.create;
    Attachment.create = async () => { throw new Error('database unavailable'); };

    try {
      await attachmentService.createAttachmentRecord({
        conversationId: '507f1f77bcf86cd799439011',
        uploaderId: '507f1f77bcf86cd799439012',
        originalName: 'cleanup.txt',
        mimeType: 'text/plain',
        buffer: Buffer.from('cleanup'),
      });
      expect.fail('Expected database persistence to fail');
    } catch (error) {
      expect(error.message).to.equal('database unavailable');
      expect(fs.readdirSync(path.join(storageRoot, 'conversations', '507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012'))).to.have.length(0);
    } finally {
      Attachment.create = originalCreate;
    }
  });
});
