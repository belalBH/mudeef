import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { getUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { todayISO } from '@/lib/dates';

export const dynamic = 'force-dynamic';

// Full database copy for the owner. It holds every account on this server, so only the first owner (server admin) may take it.
export async function GET() {
  const user = await getUser();
  if (!user || user.role !== 'owner') return new Response('Forbidden', { status: 403 });
  const first = db.prepare("SELECT MIN(id) id FROM users WHERE role = 'owner'").get().id;
  if (user.id !== first && process.env.ALLOW_ALL_OWNER_BACKUPS !== 'true') {
    return new Response('النسخة الاحتياطية الكاملة متاحة لمدير السيرفر فقط. استخدم تصدير Excel لبياناتك.', {
      status: 403,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
  const tmp = path.join(os.tmpdir(), `mudeef-backup-${Date.now()}.db`);
  await db.backup(tmp);
  const buf = fs.readFileSync(tmp);
  fs.unlinkSync(tmp);
  return new Response(buf, {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="mudeef-${todayISO()}.db"`,
      'Cache-Control': 'no-store',
    },
  });
}
