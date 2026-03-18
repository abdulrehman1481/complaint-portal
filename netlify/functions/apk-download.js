const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { jsonResponse } = require('./_apkAuth');

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET = process.env.R2_BUCKET;
const R2_APK_OBJECT_KEY = process.env.R2_APK_OBJECT_KEY || 'latest/civic-services-latest.apk';

const requireR2Config = () => {
  const missing = [];
  if (!R2_ACCOUNT_ID) missing.push('R2_ACCOUNT_ID');
  if (!R2_ACCESS_KEY_ID) missing.push('R2_ACCESS_KEY_ID');
  if (!R2_SECRET_ACCESS_KEY) missing.push('R2_SECRET_ACCESS_KEY');
  if (!R2_BUCKET) missing.push('R2_BUCKET');

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
  if (event.httpMethod !== 'GET') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  try {
    requireR2Config();

    const r2 = createR2Client();
    const command = new GetObjectCommand({
      Bucket: R2_BUCKET,
      Key: R2_APK_OBJECT_KEY,
      ResponseContentType: 'application/vnd.android.package-archive',
      ResponseContentDisposition: 'attachment; filename="civic-services-latest.apk"',
    });

    const signedDownloadUrl = await getSignedUrl(r2, command, { expiresIn: 300 });

    return {
      statusCode: 302,
      headers: {
        Location: signedDownloadUrl,
        'Cache-Control': 'no-store',
      },
      body: '',
    };
  } catch (error) {
    console.error('apk-download error:', error);
    return jsonResponse(500, { error: error.message || 'Failed to prepare download.' });
  }
};
