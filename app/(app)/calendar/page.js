import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { bookingsInRange, listUnits } from '@/lib/queries';
import { addDays, addMonths, daysInMonth, diffDays, isWeekend, monthName, parseISO, todayISO } from '@/lib/dates';
import { SOURCES } from '@/lib/constants';
import ScrollToToday from '@/components/ScrollToToday';

export const metadata = { title: 'التقويم | مُضيف' };

const DAY_W = 44; // px per night column
const ROW_H = 52;

export default async function CalendarPage({ searchParams }) {
  const user = await requireUser();
  const sp = await searchParams;
  const today = todayISO();
  const ym = /^\d{4}-\d{2}$/.test(sp.m || '') ? sp.m : today.slice(0, 7);
  const from = `${ym}-01`;
  const days = daysInMonth(ym);
  const to = addDays(from, days);
  const units = listUnits(user.account_id, { activeOnly: true });
  const bookings = bookingsInRange(user.account_id, from, to);
  const dates = Array.from({ length: days }, (_, i) => addDays(from, i));

  const byUnit = Object.fromEntries(units.map((u) => [u.id, []]));
  for (const b of bookings) byUnit[b.unit_id]?.push(b);
  // Double bookings get their own lane so both stays stay visible instead of hiding each other
  const lanes = {};
  for (const [uid, list] of Object.entries(byUnit)) {
    const ends = [];
    for (const b of list) {
      let lane = ends.findIndex((e) => e <= b.check_in);
      if (lane === -1) lane = ends.length;
      ends[lane] = b.check_out;
      b.lane = lane;
    }
    lanes[uid] = Math.max(1, ends.length);
  }
  const LANE_H = ROW_H - 16;
  const rowH = (uid) => 16 + lanes[uid] * LANE_H + (lanes[uid] - 1) * 4;

  return (
    <>
      <header className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Link href={`/calendar?m=${addMonths(ym, -1)}`} className="btn-ghost px-3" aria-label="الشهر السابق">
            ›
          </Link>
          <h1 className="min-w-[11rem] text-center">{monthName(ym)}</h1>
          <Link href={`/calendar?m=${addMonths(ym, 1)}`} className="btn-ghost px-3" aria-label="الشهر التالي">
            ‹
          </Link>
          {ym !== today.slice(0, 7) && (
            <Link href="/calendar" className="ms-2 text-sm text-palm hover:underline">هذا الشهر</Link>
          )}
        </div>
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
          {Object.entries(SOURCES).map(([k, s]) => (
            <li key={k} className="flex items-center gap-1.5">
              <span className="h-2.5 w-5 rounded-full" style={{ background: s.color }} />
              {s.label}
            </li>
          ))}
        </ul>
      </header>

      {units.length === 0 ? (
        <div className="panel px-6 py-12 text-center">
          <p className="text-muted">التقويم يعرض حجوزات وحداتك. أضف وحدة لتبدأ.</p>
          <Link href="/units/new" className="btn-primary mt-4">إضافة وحدة</Link>
        </div>
      ) : (
        <div className="panel overflow-x-auto">
          <div style={{ minWidth: `calc(var(--unit-col) + ${DAY_W * days}px)` }} className="[--unit-col:112px] sm:[--unit-col:180px]">
            {/* Day header */}
            <div className="sticky top-0 z-10 flex border-b border-line bg-white">
              <div className="sticky start-0 z-10 w-[var(--unit-col)] shrink-0 border-e border-line bg-white px-3 py-2 text-xs text-muted">
                الوحدة
              </div>
              {dates.map((d) => {
                const isToday = d === today;
                return (
                  <div
                    key={d}
                    id={isToday ? 'cal-today' : undefined}
                    className={`shrink-0 py-1.5 text-center text-xs ${isWeekend(d) ? 'bg-saffron-soft/60' : ''}`}
                    style={{ width: DAY_W }}
                  >
                    <div className="text-muted">{['ح', 'ن', 'ث', 'ر', 'خ', 'ج', 'س'][parseISO(d).getUTCDay()]}</div>
                    <div className={`mx-auto mt-0.5 grid h-6 w-6 place-items-center rounded-full ${isToday ? 'bg-palm font-bold text-white' : 'font-medium'}`}>
                      {Number(d.slice(8))}
                    </div>
                  </div>
                );
              })}
            </div>

            {units.map((u) => (
              <div key={u.id} className="flex border-b border-line last:border-b-0">
                <Link
                  href={`/units/${u.id}`}
                  className="sticky start-0 z-[5] flex w-[var(--unit-col)] shrink-0 items-center border-e border-line bg-white px-3 text-sm font-semibold hover:text-palm"
                  style={{ height: rowH(u.id) }}
                >
                  <span className="truncate">{u.name}</span>
                </Link>
                <div className="relative flex" style={{ height: rowH(u.id) }}>
                  {dates.map((d) => (
                    <Link
                      key={d}
                      href={`/bookings/new?unit=${u.id}&from=${d}&to=${addDays(d, 1)}`}
                      title="حجز جديد من هذا اليوم"
                      className={`shrink-0 border-e border-line/50 hover:bg-palm-soft ${isWeekend(d) ? 'bg-saffron-soft/40' : ''} ${d === today ? 'bg-palm-soft/70' : ''}`}
                      style={{ width: DAY_W }}
                      aria-label={`حجز ${u.name} يوم ${d}`}
                    />
                  ))}
                  {byUnit[u.id].map((b) => {
                    // Stays run from mid check-in day to mid check-out day, so a checkout and a checkin share a cell without touching
                    const startOff = Math.max(-0.5, diffDays(from, b.check_in)) + 0.5;
                    const endOff = Math.min(days + 0.5, diffDays(from, b.check_out) + 0.5);
                    const clippedStart = Math.max(0, startOff);
                    const clippedEnd = Math.min(days, endOff);
                    const width = (clippedEnd - clippedStart) * DAY_W - 4;
                    if (width <= 0) return null;
                    const color = SOURCES[b.source]?.color || SOURCES.other.color;
                    return (
                      <Link
                        key={b.id}
                        href={`/bookings/${b.id}`}
                        title={`${b.guest_name || 'حجز'}: ${b.check_in} إلى ${b.check_out}`}
                        className={`absolute flex items-center overflow-hidden px-2 text-xs font-medium text-white shadow-sm hover:brightness-110 ${
                          b.conflict ? 'ring-2 ring-danger ring-offset-1' : ''
                        } ${startOff < 0.5 ? 'rounded-s-sm' : 'rounded-s-full'} ${endOff > days ? 'rounded-e-sm' : 'rounded-e-full'}`}
                        style={{
                          insetInlineStart: clippedStart * DAY_W + 2,
                          top: 8 + b.lane * (LANE_H + 4),
                          width,
                          height: LANE_H,
                          background: b.conflict
                            ? `repeating-linear-gradient(135deg, ${color} 0 8px, #B4382F 8px 12px)`
                            : color,
                        }}
                      >
                        <span dir="auto" className="truncate">{b.guest_name || 'محجوز'}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {ym === today.slice(0, 7) && <ScrollToToday targetId="cal-today" />}
      <p className="mt-3 text-sm text-muted">اضغط على أي يوم فارغ لتسجيل حجز مباشر، أو على أي حجز لفتح تفاصيله.</p>
    </>
  );
}
