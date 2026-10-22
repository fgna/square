import { NextResponse } from 'next/server';
import { createReadStream, promises as fs } from 'fs';
import { join } from 'path';
import { Readable } from 'stream';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// A release APK is provisioned outside the repository and mounted read-only.
// Never fall back to the Dockerfile's zero-byte placeholder or a debug APK.
const debugMode = process.env.COMMUNITY_ENABLE_DEBUG_APK_DOWNLOAD === 'true' &&
  process.env.COMMUNITY_TEST_INSTANCE === 'true';
const APK_PATH = debugMode
  ? (process.env.COMMUNITY_DEBUG_APK_PATH || join(process.cwd(), 'debug-apk', 'community.apk'))
  : (process.env.COMMUNITY_RELEASE_APK_PATH || join(process.cwd(), 'release', 'community.apk'));

async function availableApk() {
  try {
    const stat = await fs.stat(APK_PATH);
    return stat.isFile() && stat.size > 0 ? stat : null;
  } catch {
    return null;
  }
}

export async function GET() {
  const stat = await availableApk();
  if (!stat) return new NextResponse('Android APK not published for this instance', { status: 404 });
  const file = createReadStream(APK_PATH);
  return new NextResponse(Readable.toWeb(file) as ReadableStream, {
    headers: {
      'Content-Type': 'application/vnd.android.package-archive',
      'Content-Disposition': 'attachment; filename="community.apk"',
      'Content-Length': String(stat.size),
      'Cache-Control': 'no-store',
      'X-Community-Apk-Channel': debugMode ? 'development' : 'release',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

export async function HEAD() {
  const stat = await availableApk();
  return new NextResponse(null, { status: stat ? 200 : 404, headers: { 'Cache-Control': 'no-store' } });
}
