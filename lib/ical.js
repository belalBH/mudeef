import ical from 'node-ical';
import { db } from './db';
import { refreshConflicts, syncCleaningTask } from './bookings';
import { addDays, todayISO, toISO } from './dates';
import { sourceLabel } from './constants';

function dateOnly(v) {
  if (!v) return null;
  if (typeof v === 'string') return v.slice(0, 10).replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3');
  // All-day events are parsed as local-midnight dates; keep the calendar day as written in the feed
  if (v.dateOnly || v.datetype === 'date') {
    return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}-${String(v.getDate()).padStart(2, '0')}`;
  }
  return toISO(v);
}

// Pulls a guest name out of the free-text summary platforms put in their feeds
function guessGuest(summary, source) {
  const s = (summary || '').trim();
  if (!s) return null;
  const generic = /^(reserved|not available|closed|blocked|airbnb|booking|محجوز|غير متاح)/i;
  if (generic.test(s)) return null;
  return s.slice(0, 80);
}

export function parseFeed(text) {
  const data = ical.sync.parseICS(text);
  const events = [];
  for (const key of Object.keys(data)) {
    const ev = data[key];
    if (ev.type !== 'VEVENT') continue;
    const start = dateOnly(ev.start);
    let end = dateOnly(ev.end) || (start && addDays(start, 1));
    if (!start || !end) continue;
    if (end <= start) end = addDays(start, 1);
    if (ev.status && String(ev.status).toUpperCase() === 'CANCELLED') continue;
    events.push({
      uid: ev.uid || `${start}_${end}`,
      start,
      end,
      summary: typeof ev.summary === 'string' ? ev.summary : ev.summary?.val || '',
      description: typeof ev.description === 'string' ? ev.description : '',
    });
  }
  return events;
}

export async function syncChannel(channelId) {
  const ch = db.prepare(`SELECT * FROM channels WHERE id = ?`).get(channelId);
  if (!ch || !ch.import_url) return { ok: false, message: 'لا يوجد رابط استيراد' };

  const setStatus = db.prepare(
    `UPDATE channels SET last_sync_at = datetime('now'), last_sync_status = ?, last_sync_message = ? WHERE id = ?`
  );

  let events;
  try {
    const res = await fetch(ch.import_url, {
      headers: { 'User-Agent': 'Mudeef-ChannelSync/1.0' },
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) throw new Error(`رد الخادم ${res.status}`);
    const text = await res.text();
    if (!text.includes('BEGIN:VCALENDAR')) throw new Error('الرابط لا يعيد تقويم iCal صالح');
    events = parseFeed(text);
  } catch (e) {
    setStatus.run('error', String(e.message || e).slice(0, 300), ch.id);
    return { ok: false, message: e.message };
  }

  const today = todayISO();
  const seen = new Set();
  let added = 0;
  let updated = 0;

  const find = db.prepare(`SELECT id, check_in, check_out FROM bookings WHERE channel_id = ? AND external_uid = ?`);
  const insert = db.prepare(
    `INSERT INTO bookings (account_id, unit_id, channel_id, source, status, guest_name, check_in, check_out, notes, imported, external_uid)
     VALUES (?, ?, ?, ?, 'confirmed', ?, ?, ?, ?, 1, ?)`
  );
  const update = db.prepare(
    `UPDATE bookings SET check_in = ?, check_out = ?, status = 'confirmed', updated_at = datetime('now') WHERE id = ?`
  );

  const touched = [];
  const tx = db.transaction(() => {
    for (const ev of events) {
      if (ev.end < today) continue; // past stays never change, skip them
      seen.add(ev.uid);
      const existing = find.get(ch.id, ev.uid);
      if (!existing) {
        const newId = insert.run(
          ch.account_id,
          ch.unit_id,
          ch.id,
          ch.source,
          guessGuest(ev.summary, ch.source) || `ضيف ${sourceLabel(ch.source)}`,
          ev.start,
          ev.end,
          ev.description ? ev.description.slice(0, 500) : null,
          ev.uid
        ).lastInsertRowid;
        touched.push(Number(newId));
        added++;
      } else if (existing.check_in !== ev.start || existing.check_out !== ev.end) {
        update.run(ev.start, ev.end, existing.id);
        touched.push(existing.id);
        updated++;
      }
    }
    // Upcoming imported stays that disappeared from the feed were cancelled on the platform
    const stale = db
      .prepare(
        `SELECT id, external_uid FROM bookings WHERE channel_id = ? AND imported = 1 AND status = 'confirmed' AND check_out >= ?`
      )
      .all(ch.id, today)
      .filter((b) => !seen.has(b.external_uid));
    const cancel = db.prepare(`UPDATE bookings SET status = 'cancelled', updated_at = datetime('now') WHERE id = ?`);
    for (const b of stale) {
      cancel.run(b.id);
      touched.push(b.id);
    }
    return stale.length;
  });
  const cancelled = tx();
  for (const id of touched) syncCleaningTask(id);
  const conflicts = refreshConflicts(ch.unit_id);

  const msg = `جديد ${added}، معدّل ${updated}، ملغي ${cancelled}` + (conflicts ? `، تعارض ${conflicts}` : '');
  setStatus.run(conflicts ? 'warning' : 'ok', msg, ch.id);
  return { ok: true, added, updated, cancelled, conflicts, message: msg };
}

export async function syncAll(accountId = null) {
  const rows = accountId
    ? db.prepare(`SELECT id FROM channels WHERE import_url IS NOT NULL AND import_url != '' AND account_id = ?`).all(accountId)
    : db.prepare(`SELECT id FROM channels WHERE import_url IS NOT NULL AND import_url != ''`).all();
  const results = [];
  for (const r of rows) results.push({ id: r.id, ...(await syncChannel(r.id)) });
  return results;
}

function esc(s) {
  return String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

function icsDate(s) {
  return s.replace(/-/g, '');
}

// Builds the feed a platform imports. When exporting to a specific channel, that channel's own stays are left out
// so the platform does not re-block dates it already knows about.
export function buildFeed({ unitId, excludeChannelId = null, calName }) {
  const rows = db
    .prepare(
      `SELECT id, check_in, check_out, source FROM bookings
       WHERE unit_id = ? AND status = 'confirmed' AND check_out >= ?
         AND (? IS NULL OR channel_id IS NULL OR channel_id != ?)
       ORDER BY check_in`
    )
    .all(unitId, addDays(todayISO(), -30), excludeChannelId, excludeChannelId);

  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Mudeef//Channel Manager//AR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${esc(calName)}`,
  ];
  for (const b of rows) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:mudeef-${b.id}@mudeef`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${icsDate(b.check_in)}`,
      `DTEND;VALUE=DATE:${icsDate(b.check_out)}`,
      // Never leak guest details to other platforms
      'SUMMARY:Not available',
      'END:VEVENT'
    );
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n') + '\r\n';
}
