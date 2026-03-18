const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { jsonResponse, ensureSuperAdmin } = require('./_apkAuth');

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET = process.env.R2_BUCKET;
const R2_PUBLIC_BASE_URL = process.env.R2_PUBLIC_BASE_URL;
const R2_APK_OBJECT_KEY = process.env.R2_APK_OBJECT_KEY || 'latest/civic-services-latest.apk';

const requireR2Config = () => {
  const missing = [];
  if (!R2_ACCOUNT_ID) missing.push('R2_ACCOUNT_ID');
  if (!R2_ACCESS_KEY_ID) missing.push('R2_ACCESS_KEY_ID');
  if (!R2_SECRET_ACCESS_KEY) missing.push('R2_SECRET_ACCESS_KEY');
  if (!R2_BUCKET) missing.push('R2_BUCKET');
  if (!R2_PUBLIC_BASE_URL) missing.push('R2_PUBLIC_BASE_URL');

  if (missing.length > 0) {
    throw new Error(`Missing environment variables: ${missing.join(', ')}`);
  }
};

const createR2Client = () =>
  new S3Client({
    region: 'auto',
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
  });

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  try {
    requireR2Config();

    const authCheck = await ensureSuperAdmin(event.headers);
    if (!authCheck.ok) return authCheck.response;

    const body = event.body ? JSON.parse(event.body) : {};
    const fileName = String(body.fileName || '').trim();

    if (!fileName || !fileName.toLowerCase().endsWith('.apk')) {
      return jsonResponse(400, { error: 'Please provide a valid .apk file name.' });
    }

    const contentType = 'application/vnd.android.package-archive';
    const r2 = createR2Client();

    const putCommand = new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: R2_APK_OBJECT_KEY,
      ContentType: contentType,
      CacheControl: 'public, max-age=60',
    });

    const uploadUrl = await getSignedUrl(r2, putCommand, { expiresIn: 900 });
    const publicUrl = `${R2_PUBLIC_BASE_URL.replace(/\/$/, '')}/${R2_APK_OBJECT_KEY}`;

    return jsonResponse(200, {
      uploadUrl,
      publicUrl,
      objectKey: R2_APK_OBJECT_KEY,
      expiresInSeconds: 900,
    });
  } catch (error) {
    console.error('apk-create-upload-url error:', error);
    return jsonResponse(500, { error: error.message || 'Failed to create upload URL.' });
  }
};
