import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { yearReport } from '@/lib/queries';
import { monthShort, todayISO } from '@/lib/dates';
import { SOURCES, money, num } from '@/lib/constants';
import PageHead from '@/components/PageHead';

export const metadata = { title: 'التقارير | مُضيف' };

const pct = (v) => `${Math.round(v * 100)}%`;

export default async function ReportsPage({ searchParams }) {
  const user = await requireUser();
  const sp = await searchParams;
  const thisYear = Number(todayISO().slice(0, 4));
  const year = Number(sp.y) >= 2000 && Number(sp.y) <= 2100 ? Number(sp.y) : thisYear;
  const r = yearReport(user.account_id, year);
  const maxRev = Math.max(1, ...r.months.map((m) => m.revenue));
  const sources = Object.entries(r.bySource).sort((a, b) => b[1].revenue - a[1].revenue);
  const totalSourceRev = sources.reduce((a, [, s]) => a + s.revenue, 0) || 1;

  return (
    <>
      <PageHead title={`تقرير ${year}`} sub="الإيرادات الصافية بعد عمولات المنصات، موزعة على الليالي الفعلية.">
        <Link href={`/reports?y=${year - 1}`} className="btn-ghost">{year - 1}</Link>
        {year < thisYear + 1 && <Link href={`/reports?y=${year + 1}`} className="btn-ghost">{year + 1}</Link>}
      </PageHead>

      <dl className="mb-10 grid grid-cols-2 gap-x-6 gap-y-5 border-y border-line py-5 md:grid-cols-4">
        <div><dt className="text-sm text-muted">صافي الإيرادات</dt><dd className="mt-1 text-2xl font-bold">{money(r.totals.revenue)}</dd></div>
        <div><dt className="text-sm text-muted">نسبة الإشغال</dt><dd className="mt-1 text-2xl font-bold">{pct(r.totals.occupancy)}</dd></div>
        <div><dt className="text-sm text-muted">ليالٍ محجوزة</dt><dd className="mt-1 text-2xl font-bold">{num(r.totals.nights)}</dd></div>
        <div><dt className="text-sm text-muted">متوسط سعر الليلة</dt><dd className="mt-1 text-2xl font-bold">{money(r.totals.adr)}</dd></div>
      </dl>

      <section className="mb-12">
        <h2 className="mb-4">الإيرادات والإشغال حسب الشهر</h2>
        <div className="panel overflow-x-auto p-5">
          <div className="flex min-w-[640px] items-end gap-2" style={{ height: 220 }}>
            {r.months.map((m) => (
              <div key={m.m} className="flex h-full flex-1 flex-col justify-end text-center">
                <span className="mb-1 text-[11px] text-muted">{m.revenue ? num(m.revenue) : ''}</span>
                <div
                  className="mx-auto w-full max-w-[36px] rounded-t-md bg-palm"
                  style={{ height: `${(m.revenue / maxRev) * 150}px`, minHeight: m.revenue ? 3 : 0 }}
                  title={`${monthShort(m.m)}: ${money(m.revenue)}`}
                />
              </div>
            ))}
          </div>
          <div className="mt-2 flex min-w-[640px] gap-2 border-t border-line pt-2">
            {r.months.map((m) => (
              <div key={m.m} className="flex-1 text-center">
                <div className="text-xs font-medium">{monthShort(m.m)}</div>
                <div className={`text-[11px] ${m.occupancy >= 0.7 ? 'font-semibold text-palm' : 'text-muted'}`}>{pct(m.occupancy)}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="grid gap-10 xl:grid-cols-2">
        <section>
          <h2 className="mb-3">حسب المنصة</h2>
          {sources.length === 0 ? (
            <p className="text-muted">لا توجد حجوزات في {year}.</p>
          ) : (
            <div className="panel overflow-x-auto">
              <table className="table">
                <thead>
                  <tr><th>المنصة</th><th>الحجوزات</th><th>الإجمالي</th><th>العمولات</th><th>الصافي</th></tr>
                </thead>
                <tbody>
                  {sources.map(([k, s]) => (
                    <tr key={k}>
                      <td>
                        <div className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ background: SOURCES[k]?.color }} />
                          {SOURCES[k]?.label || k}
                        </div>
                        <div className="mt-1.5 h-1 rounded-full bg-line">
                          <div className="h-full rounded-full" style={{ width: `${(s.revenue / totalSourceRev) * 100}%`, background: SOURCES[k]?.color }} />
                        </div>
                      </td>
                      <td>{num(s.bookings)}</td>
                      <td>{money(s.gross)}</td>
                      <td className="text-danger">{money(s.commission)}</td>
                      <td className="font-semibold">{money(s.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-3">حسب الوحدة</h2>
          <div className="panel overflow-x-auto">
            <table className="table">
              <thead>
                <tr><th>الوحدة</th><th>الليالي</th><th>الإشغال</th><th>الصافي</th></tr>
              </thead>
              <tbody>
                {[...r.byUnit].sort((a, b) => b.revenue - a.revenue).map((u) => (
                  <tr key={u.name}>
                    <td className="font-semibold">{u.name}</td>
                    <td>{num(u.nights)}</td>
                    <td>{pct(u.occupancy)}</td>
                    <td>{money(u.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </>
  );
}
