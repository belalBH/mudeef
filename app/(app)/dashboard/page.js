import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { dashboard } from '@/lib/queries';
import { addDays, diffDays, monthName, nightsLabel, prettyDate, weekday } from '@/lib/dates';
import { money, num, sourceLabel } from '@/lib/constants';
import { SourceTag } from '@/components/badges';

export const metadata = { title: 'اليوم | مُضيف' };

export default async function DashboardPage() {
  const user = await requireUser();
  const d = dashboard(user.account_id);

  if (d.units === 0) {
    return (
      <div className="max-w-xl py-10">
        <h1>أهلاً {user.name}</h1>
        <p className="mt-3 text-muted">ثلاث خطوات وتصير كل حجوزاتك في مكان واحد:</p>
        <ol className="mt-5 space-y-4">
          {[
            ['أضف وحداتك', 'كل غرفة أو استوديو تؤجره.'],
            ['اربط المنصات', 'الصق روابط تقويم Airbnb وBooking.com وجاذر إن.'],
            ['تابع من التقويم', 'كل الحجوزات في شاشة واحدة، والتعارضات تظهر فوراً.'],
          ].map(([t, s], i) => (
            <li key={t} className="flex gap-4">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-palm text-sm font-bold text-white">{i + 1}</span>
              <div>
                <p className="font-semibold">{t}</p>
                <p className="text-sm text-muted">{s}</p>
              </div>
            </li>
          ))}
        </ol>
        <Link href="/units/new" className="btn-primary mt-8">إضافة أول وحدة</Link>
      </div>
    );
  }

  const tomorrow = addDays(d.today, 1);
  const label = (date) => (date === d.today ? 'اليوم' : date === tomorrow ? 'بكرة' : `${weekday(date)} ${prettyDate(date)}`);

  return (
    <>
      <header className="mb-8">
        <p className="text-muted">{weekday(d.today)}، {prettyDate(d.today)}</p>
        <h1 className="mt-1">
          {d.inHouse === 0 ? 'لا يوجد ضيوف مقيمون الآن' : `${num(d.inHouse)} من ${num(d.units)} وحدات مشغولة الليلة`}
        </h1>
      </header>

      {(d.conflicts.length > 0 || d.syncErrors.length > 0) && (
        <section className="mb-8 space-y-3" aria-label="تنبيهات">
          {d.conflicts.length > 0 && (
            <Link href="/bookings?view=conflicts" className="block rounded-lg border border-danger/30 bg-danger-soft p-4 hover:border-danger">
              <p className="font-semibold text-danger">يوجد {num(d.conflicts.length)} حجز متعارض</p>
              <p className="mt-1 text-sm">
                {d.conflicts.slice(0, 3).map((c) => `${c.unit_name} (${sourceLabel(c.source)} ${prettyDate(c.check_in)})`).join('، ')}
              </p>
            </Link>
          )}
          {d.syncErrors.map((c) => (
            <Link key={c.id} href={`/units/${c.unit_id}`} className="block rounded-lg border border-saffron/40 bg-saffron-soft p-4 hover:border-saffron">
              <p className="font-semibold">توقفت مزامنة {sourceLabel(c.source)} في {c.unit_name}</p>
              <p className="mt-1 text-sm text-muted">{c.last_sync_message}</p>
            </Link>
          ))}
        </section>
      )}

      <dl className="mb-10 grid grid-cols-2 gap-x-6 gap-y-5 border-y border-line py-5 md:grid-cols-4">
        <Stat k={`إشغال ${monthName(d.today.slice(0, 7))}`} v={`${Math.round(d.occupancy * 100)}%`} bar={d.occupancy} />
        <Stat k="الصافي هذا الشهر" v={money(d.revenue)} />
        <Stat k="ليالٍ محجوزة هذا الشهر" v={num(d.nights)} />
        <Stat k="مغادرات اليوم" v={num(d.departures.length)} />
      </dl>

      <div className="grid gap-10 xl:grid-cols-[1.4fr_1fr]">
        <section>
          <h2 className="mb-3">الوصول خلال 7 أيام</h2>
          {d.arrivals.length === 0 ? (
            <p className="text-muted">لا يوجد ضيوف قادمون هذا الأسبوع.</p>
          ) : (
            <ul className="panel divide-y divide-line">
              {d.arrivals.map((b) => (
                <li key={b.id}>
                  <Link href={`/bookings/${b.id}`} className="flex items-center gap-4 px-4 py-3 hover:bg-paper/60">
                    <span className={`w-24 shrink-0 text-sm ${b.check_in === d.today ? 'font-bold text-palm' : 'text-muted'}`}>
                      {label(b.check_in)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{b.guest_name || 'بدون اسم'}</span>
                      <span className="block text-sm text-muted">
                        {b.unit_name}، {nightsLabel(diffDays(b.check_in, b.check_out))}
                      </span>
                    </span>
                    <SourceTag source={b.source} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2 className="mb-3">يغادرون اليوم</h2>
          {d.departures.length === 0 ? (
            <p className="text-muted">لا توجد مغادرات اليوم.</p>
          ) : (
            <ul className="panel divide-y divide-line">
              {d.departures.map((b) => (
                <li key={b.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <span>
                    <span className="block font-semibold">{b.unit_name}</span>
                    <span className="text-sm text-muted">{b.guest_name || 'ضيف'}، جهّز التنظيف بعد الخروج</span>
                  </span>
                  <Link href={`/bookings/${b.id}`} className="text-sm text-palm hover:underline">التفاصيل</Link>
                </li>
              ))}
            </ul>
          )}
          {d.unpriced > 0 && (
            <p className="mt-6 rounded-md bg-saffron-soft px-4 py-3 text-sm">
              {num(d.unpriced)} حجز مستورد من المنصات بدون مبلغ. أضف المبالغ لتظهر الإيرادات صحيحة في التقارير.{' '}
              <Link href="/bookings?view=all" className="font-semibold underline underline-offset-2">عرض الحجوزات</Link>
            </p>
          )}
        </section>
      </div>
    </>
  );
}

function Stat({ k, v, bar }) {
  return (
    <div>
      <dt className="text-sm text-muted">{k}</dt>
      <dd className="mt-1 text-2xl font-bold">{v}</dd>
      {bar !== undefined && (
        <div className="mt-2 h-1.5 w-full max-w-[10rem] rounded-full bg-line">
          <div className="h-full rounded-full bg-palm" style={{ width: `${Math.min(100, bar * 100)}%` }} />
        </div>
      )}
    </div>
  );
}
