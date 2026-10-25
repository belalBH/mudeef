import fs from 'node:fs';
import path from 'node:path';
import { UPLOAD_DIR } from '@/lib/files';

const TYPES = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };

// Unit photos are public: they appear on the direct booking page
export async function GET(req, { params }) {
  const { name } = await params;
  const m = /^([a-f0-9]{24})\.(jpg|png|webp)$/.exec(name);
  if (!m) return new Response('Not found', { status: 404 });
  try {
    const buf = fs.readFileSync(path.join(UPLOAD_DIR, name));
    return new Response(buf, { headers: { 'Content-Type': TYPES[m[2]], 'Cache-Control': 'public, max-age=31536000, immutable' } });
  } catch {
    return new Response('Not found', { status: 404 });
  }
}
