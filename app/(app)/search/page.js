import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { search } from '@/lib/queries-v3';
import { prettyDate } from '@/lib/dates';
import { UNIT_TYPES, money } from '@/lib/constants';
import { SourceTag, StatusTag } from '@/components/badges';

export const metadata = { title: 'بحث | مُضيف' };

export default async function SearchPage({ searchParams }) {
  const user = await requireUser();
  const q = String((await searchParams).q || '').slice(0, 80);
  const r = search(user.account_id, q);
  const total = r.bookings.length + r.guests.length + r.units.length;

  return (
    <div className="max-w-4xl">
      <form action="/search" className="mb-6 flex gap-2" role="search">
        <input name="q" defaultValue={q} autoFocus placeholder="اسم الضيف، رقم الجوال، رقم الحجز، رقم الهوية، اسم الوحدة" className="field text-base" />
        <button className="btn-primary">بحث</button>
      </form>
      {q && total === 0 && <p className="text-muted">لا توجد نتائج لـ "{q}".</p>}

      {r.bookings.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-2">الحجوزات ({r.bookings.length})</h2>
          <ul className="panel divide-y divide-line">
            {r.bookings.map((b) => (
              <li key={b.id}>
                <Link href={`/bookings/${b.id}`} className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 hover:bg-paper/60">
                  <span>
                    <span className="font-semibold" dir="auto">{b.guest_name || 'بدون اسم'}</span>
                    <span className="text-sm text-muted"> #{b.id}، {b.unit_name}، {prettyDate(b.check_in)} {b.check_in.slice(0, 4)}</span>
                  </span>
                  <span className="flex items-center gap-3 text-sm">
                    <SourceTag source={b.source} />
                    {money(b.total_amount)}
                    <StatusTag booking={b} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      {r.guests.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-2">الضيوف ({r.guests.length})</h2>
          <ul className="panel divide-y divide-line">
            {r.guests.map((g) => (
              <li key={g.id}>
                <Link href={`/guests/${g.id}`} className="flex justify-between px-4 py-2.5 hover:bg-paper/60">
                  <span className="font-semibold" dir="auto">{g.name}</span>
                  <span className="text-sm text-muted" dir="ltr">{g.phone}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      {r.units.length > 0 && (
        <section>
          <h2 className="mb-2">الوحدات</h2>
          <ul className="panel divide-y divide-line">
            {r.units.map((u) => (
              <li key={u.id}>
                <Link href={`/units/${u.id}`} className="flex justify-between px-4 py-2.5 hover:bg-paper/60">
                  <span className="font-semibold">{u.name}</span>
                  <span className="text-sm text-muted">{UNIT_TYPES[u.type]}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
