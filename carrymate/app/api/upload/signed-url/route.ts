import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { Storage } from '@google-cloud/storage';
import { getAuthUserId, unauthorizedResponse } from '@/lib/api-auth';

interface SignedUrlBody {
  filename: string;
  contentType: string;
  folder?: string;
}

function getStorageClient(): Storage | null {
  if (!process.env.GCS_BUCKET_NAME || !process.env.GCS_PROJECT_ID) {
    return null;
  }

  return new Storage({
    projectId: process.env.GCS_PROJECT_ID,
    credentials: {
      client_email: process.env.GCS_CLIENT_EMAIL ?? '',
      private_key: process.env.GCS_PRIVATE_KEY?.replace(/\\n/g, '\n') ?? '',
    },
  });
}

export async function POST(request: Request): Promise<Response> {
  try {
    const userId = await getAuthUserId(request);
    if (!userId) return unauthorizedResponse();

    const body = (await request.json()) as SignedUrlBody;
    if (!body.filename || !body.contentType) {
      return NextResponse.json(
        { error: 'filename and contentType are required' },
        { status: 400 }
      );
    }

    const folder = body.folder ?? 'uploads';
    const safeFilename = body.filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const objectPath = `${folder}/${userId}/${Date.now()}-${safeFilename}`;

    const storage = getStorageClient();
    const bucketName = process.env.GCS_BUCKET_NAME;

    if (!storage || !bucketName) {
      const mockUrl = `https://storage.mock.carrymate.com.au/${objectPath}?token=mock-${randomUUID()}`;
      return NextResponse.json({
        uploadUrl: mockUrl,
        publicUrl: mockUrl.split('?')[0],
        objectPath,
        mock: true,
      });
    }

    const bucket = storage.bucket(bucketName);
    const file = bucket.file(objectPath);

    const [uploadUrl] = await file.getSignedUrl({
      version: 'v4',
      action: 'write',
      expires: Date.now() + 15 * 60 * 1000,
      contentType: body.contentType,
    });

    const publicUrl = `https://storage.googleapis.com/${bucketName}/${objectPath}`;

    return NextResponse.json({
      uploadUrl,
      publicUrl,
      objectPath,
      mock: false,
    });
  } catch (error) {
    console.error('Signed URL error:', error);
    return NextResponse.json({ error: 'Failed to generate signed URL' }, { status: 500 });
  }
}
