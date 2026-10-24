import { db } from '@/lib/db';
import { buildFeed } from '@/lib/ical';

export const dynamic = 'force-dynamic';

// Public calendar feed that the platforms poll. The token in the URL is the only credential.
export async function GET(req, { params }) {
  const { token } = await params;
  const t = token.replace(/\.ics$/, '');

  let unitId;
  let exclude = null;
  let name;
  const ch = db
    .prepare('SELECT c.id, c.unit_id, u.name FROM channels c JOIN units u ON u.id = c.unit_id WHERE c.export_token = ?')
    .get(t);
  if (ch) {
    unitId = ch.unit_id;
    exclude = ch.id;
    name = ch.name;
  } else {
    const u = db.prepare('SELECT id, name FROM units WHERE export_token = ?').get(t);
    if (!u) return new Response('Not found', { status: 404 });
    unitId = u.id;
    name = u.name;
  }

  return new Response(buildFeed({ unitId, excludeChannelId: exclude, calName: name }), {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="calendar.ics"',
      'Cache-Control': 'no-store',
    },
  });
}
