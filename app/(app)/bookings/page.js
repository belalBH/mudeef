import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { listBookings, listUnits } from '@/lib/queries';
import { diffDays, prettyDate, weekday } from '@/lib/dates';
import { SOURCES, money } from '@/lib/constants';
import PageHead from '@/components/PageHead';
import { SourceTag, StatusTag } from '@/components/badges';

export const metadata = { title: 'الحجوزات | مُضيف' };

const VIEWS = [
  ['upcoming', 'القادمة والحالية'],
  ['past', 'السابقة'],
  ['cancelled', 'الملغاة'],
  ['conflicts', 'التعارضات'],
  ['all', 'الكل'],
];

export default async function BookingsPage({ searchParams }) {
  const user = await requireUser();
  const sp = await searchParams;
  const view = VIEWS.some(([k]) => k === sp.view) ? sp.view : 'upcoming';
  const unit = Number(sp.unit) || null;
  const source = SOURCES[sp.source] ? sp.source : null;
  const q = (sp.q || '').trim();
  const rows = listBookings(user.account_id, { view, unit, source, q });
  const units = listUnits(user.account_id);

  const href = (v) => {
    const p = new URLSearchParams();
    p.set('view', v);
    if (unit) p.set('unit', unit);
    if (source) p.set('source', source);
    if (q) p.set('q', q);
    return `/bookings?${p}`;
  };

  return (
    <>
      <PageHead title="الحجوزات">
        <Link href="/bookings/new" className="btn-primary">حجز جديد</Link>
      </PageHead>

      <div className="mb-4 flex flex-wrap gap-1 border-b border-line">
        {VIEWS.map(([k, label]) => (
          <Link
            key={k}
            href={href(k)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm ${
              view === k ? 'border-palm font-semibold text-palm' : 'border-transparent text-muted hover:text-ink'
            }`}
          >
            {label}
          </Link>
        ))}
      </div>

      <form className="mb-4 flex flex-wrap gap-2" action="/bookings">
        <input type="hidden" name="view" value={view} />
        <input name="q" defaultValue={q} placeholder="ابحث باسم الضيف أو الجوال" className="field w-60" />
        <select name="unit" defaultValue={unit || ''} className="field w-auto">
          <option value="">كل الوحدات</option>
          {units.map((u) => (
            <option key={u.id} value={u.id}>{u.name}</option>
          ))}
        </select>
        <select name="source" defaultValue={source || ''} className="field w-auto">
          <option value="">كل المصادر</option>
          {Object.entries(SOURCES).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
        <button className="btn-ghost">تصفية</button>
      </form>

      {rows.length === 0 ? (
        <div className="panel px-6 py-10 text-center text-muted">
          {view === 'conflicts' ? 'لا توجد حجوزات متعارضة.' : 'لا توجد حجوزات هنا.'}
        </div>
      ) : (
        <div className="panel overflow-x-auto">
          <table className="table min-w-[760px]">
            <thead>
              <tr>
                <th>الضيف</th>
                <th>الوحدة</th>
                <th>الدخول</th>
                <th>الخروج</th>
                <th>الليالي</th>
                <th>المصدر</th>
                <th>الإجمالي</th>
                <th>الحالة</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((b) => (
                <tr key={b.id} className="hover:bg-paper/60">
                  <td>
                    <Link href={`/bookings/${b.id}`} className="font-semibold hover:text-palm">
                      {b.guest_name || 'بدون اسم'}
                    </Link>
                    {b.guest_phone && <div className="text-xs text-muted" dir="ltr">{b.guest_phone}</div>}
                  </td>
                  <td>{b.unit_name}</td>
                  <td>
                    {prettyDate(b.check_in)} <span className="text-xs text-muted">{weekday(b.check_in)}</span>
                  </td>
                  <td>{prettyDate(b.check_out)}</td>
                  <td>{diffDays(b.check_in, b.check_out)}</td>
                  <td><SourceTag source={b.source} /></td>
                  <td>{b.total_amount ? money(b.total_amount) : <span className="text-xs text-saffron">بدون مبلغ</span>}</td>
                  <td><StatusTag booking={b} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
