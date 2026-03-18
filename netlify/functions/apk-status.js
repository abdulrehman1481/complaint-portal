const { S3Client, HeadObjectCommand } = require('@aws-sdk/client-s3');
const { jsonResponse } = require('./_apkAuth');

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET = process.env.R2_BUCKET;
const R2_PUBLIC_BASE_URL = process.env.R2_PUBLIC_BASE_URL;
const R2_APK_OBJECT_KEY = process.env.R2_APK_OBJECT_KEY || 'latest/civic-services-latest.apk';

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

  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET || !R2_PUBLIC_BASE_URL) {
    return jsonResponse(200, {
      exists: false,
      publicUrl: null,
      lastModified: null,
      message: 'R2 environment variables are not fully configured.',
    });
  }

  try {
    const r2 = createR2Client();
    const command = new HeadObjectCommand({
      Bucket: R2_BUCKET,
      Key: R2_APK_OBJECT_KEY,
    });

    const result = await r2.send(command);
    const publicUrl = `${R2_PUBLIC_BASE_URL.replace(/\/$/, '')}/${R2_APK_OBJECT_KEY}`;

    return jsonResponse(200, {
      exists: true,
      publicUrl,
      size: result.ContentLength || 0,
      lastModified: result.LastModified ? new Date(result.LastModified).toISOString() : null,
    });
  } catch (error) {
    // Missing object in bucket should not break page.
    if (error?.name === 'NotFound' || error?.$metadata?.httpStatusCode === 404) {
      return jsonResponse(200, {
        exists: false,
        publicUrl: `${R2_PUBLIC_BASE_URL.replace(/\/$/, '')}/${R2_APK_OBJECT_KEY}`,
        lastModified: null,
      });
    }

    console.error('apk-status error:', error);
    return jsonResponse(500, { error: 'Failed to fetch APK status.' });
  }
};
