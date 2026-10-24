import { syncAll } from '@/lib/ical';

export const dynamic = 'force-dynamic';

// Optional external trigger (server crontab). Protected by CRON_SECRET.
export async function GET(req) {
  const key = new URL(req.url).searchParams.get('key') || req.headers.get('x-cron-key');
  if (!process.env.CRON_SECRET || key !== process.env.CRON_SECRET) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }
  const results = await syncAll();
  return Response.json({ synced: results.length, results });
}
