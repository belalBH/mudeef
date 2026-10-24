// Runs once when the Node server starts: keeps every linked calendar in sync in the background.
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  if (process.env.DISABLE_AUTO_SYNC === 'true') return;
  const minutes = Math.max(5, Number(process.env.SYNC_INTERVAL_MINUTES) || 15);
  const { syncAll } = await import('./lib/ical');
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const r = await syncAll();
      if (r.length) console.log(`[sync] ${new Date().toISOString()} synced ${r.length} channel(s)`);
    } catch (e) {
      console.error('[sync] failed', e);
    } finally {
      running = false;
    }
  };
  setTimeout(tick, 20_000);
  setInterval(tick, minutes * 60_000);
}
