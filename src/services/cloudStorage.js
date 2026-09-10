const cloudinary = require('cloudinary').v2;

const isConfigured = () => {
  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;
  return Boolean(CLOUDINARY_CLOUD_NAME && CLOUDINARY_API_KEY && CLOUDINARY_API_SECRET);
};

const configure = () => {
  if (!isConfigured()) {
    return false;
  }

  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });

  return true;
};

const uploadBuffer = async ({ buffer, originalName, mimeType, folder = 'skillbridge' }) => {
  if (!configure()) {
    return {
      secureUrl: '',
      publicId: '',
      storageKey: `local:${Date.now()}-${originalName || 'document'}`,
      configured: false,
    };
  }

  const result = await cloudinary.uploader.upload_stream(
    {
      folder,
      resource_type: 'auto',
      public_id: `${Date.now()}-${String(originalName || 'document').replace(/\.[^/.]+$/, '')}`,
      type: 'upload',
    },
    (error, uploadResult) => {
      if (error) {
        throw error;
      }
      return uploadResult;
    }
  );

  const uploadPromise = new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream({
      folder,
      resource_type: 'auto',
      public_id: `${Date.now()}-${String(originalName || 'document').replace(/\.[^/.]+$/, '')}`,
      type: 'upload',
    }, (error, uploadResult) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(uploadResult);
    });

    stream.end(buffer);
  });

  const uploadResult = await uploadPromise;

  return {
    secureUrl: uploadResult?.secure_url || '',
    publicId: uploadResult?.public_id || '',
    storageKey: uploadResult?.public_id || `cloudinary:${Date.now()}`,
    configured: true,
  };
};

const destroy = async (publicId) => {
  if (!publicId || !configure()) return true;
  await cloudinary.uploader.destroy(publicId, { resource_type: 'auto' });
  return true;
};

module.exports = {
  isConfigured,
  configure,
  uploadBuffer,
  destroy,
};
