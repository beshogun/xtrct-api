import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const ENDPOINT     = process.env.S3_ENDPOINT;
const BUCKET       = process.env.S3_BUCKET;
const ACCESS_KEY   = process.env.S3_ACCESS_KEY_ID;
const SECRET_KEY   = process.env.S3_SECRET_ACCESS_KEY;
const PUBLIC_URL   = process.env.S3_PUBLIC_URL; // optional — if set, use plain public URL instead of signed

const SIGNED_URL_EXPIRES = 60 * 60 * 24; // 24 hours

function isConfigured(): boolean {
  return !!(ENDPOINT && BUCKET && ACCESS_KEY && SECRET_KEY);
}

let _client: S3Client | null = null;
function getClient(): S3Client {
  if (!_client) {
    _client = new S3Client({
      endpoint: ENDPOINT!,
      region: 'auto',
      credentials: {
        accessKeyId:     ACCESS_KEY!,
        secretAccessKey: SECRET_KEY!,
      },
      forcePathStyle: true, // required for most S3-compatible APIs (R2, MinIO, etc.)
    });
  }
  return _client;
}

/**
 * Upload a buffer to R2/S3 and return a URL.
 *
 * - If storage is configured: uploads and returns a signed URL valid for 24 hours
 *   (or a plain public URL when S3_PUBLIC_URL is set).
 * - If storage is not configured: returns a base64 data URI instead.
 */
export async function uploadBuffer(
  key: string,
  buf: Buffer,
  contentType: string,
): Promise<string> {
  if (!isConfigured()) {
    return `data:${contentType};base64,${buf.toString('base64')}`;
  }

  const client = getClient();

  await client.send(new PutObjectCommand({
    Bucket:      BUCKET!,
    Key:         key,
    Body:        buf,
    ContentType: contentType,
  }));

  if (PUBLIC_URL) {
    const base = PUBLIC_URL.replace(/\/$/, '');
    return `${base}/${key}`;
  }

  const command = new PutObjectCommand({ Bucket: BUCKET!, Key: key });
  const signed = await getSignedUrl(client, command, { expiresIn: SIGNED_URL_EXPIRES });
  return signed;
}

/**
 * Convenience: derive a storage key from a job ID and format.
 *   e.g. "screenshots/2024/06/abc123.png"
 */
export function makeStorageKey(jobId: string, format: 'screenshot' | 'pdf', ext: string): string {
  const now = new Date();
  const yy  = now.getUTCFullYear();
  const mm  = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `${format}s/${yy}/${mm}/${jobId}.${ext}`;
}
