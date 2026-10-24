import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { yearReport } from '@/lib/queries';
import { monthShort, todayISO } from '@/lib/dates';
import { EXPENSE_CATEGORIES, SOURCES, money, num } from '@/lib/constants';
import PageHead from '@/components/PageHead';

export const metadata = { title: 'التقارير | مُضيف' };

const pct = (v) => `${Math.round(v * 100)}%`;

export default async function ReportsPage({ searchParams }) {
  const user = await requireUser();
  const sp = await searchParams;
  const thisYear = Number(todayISO().slice(0, 4));
  const year = Number(sp.y) >= 2000 && Number(sp.y) <= 2100 ? Number(sp.y) : thisYear;
  const r = yearReport(user.account_id, year);
  const maxRev = Math.max(1, ...r.months.map((m) => Math.max(m.revenue, m.expenses)));
  const sources = Object.entries(r.bySource).sort((a, b) => b[1].revenue - a[1].revenue);
  const totalSourceRev = sources.reduce((a, [, s]) => a + s.revenue, 0) || 1;

  return (
    <>
      <PageHead title={`تقرير ${year}`} sub="الإيرادات الصافية بعد عمولات المنصات، موزعة على الليالي الفعلية.">
        <a href={`/api/export/report?y=${year}`} className="btn-ghost">تصدير Excel</a>
        <Link href={`/reports?y=${year - 1}`} className="btn-ghost">{year - 1}</Link>
        {year < thisYear + 1 && <Link href={`/reports?y=${year + 1}`} className="btn-ghost">{year + 1}</Link>}
      </PageHead>

      <dl className="mb-10 grid grid-cols-2 gap-x-6 gap-y-5 border-y border-line py-5 md:grid-cols-3 xl:grid-cols-6">
        <div><dt className="text-sm text-muted">صافي الإيرادات</dt><dd className="mt-1 text-2xl font-bold">{money(r.totals.revenue)}</dd></div>
        <div><dt className="text-sm text-muted">المصاريف</dt><dd className="mt-1 text-2xl font-bold text-danger">{money(r.totals.expenses)}</dd></div>
        <div><dt className="text-sm text-muted">صافي الربح</dt><dd className={`mt-1 text-2xl font-bold ${r.totals.profit < 0 ? 'text-danger' : 'text-palm'}`}>{money(r.totals.profit)}</dd></div>
        <div><dt className="text-sm text-muted">نسبة الإشغال</dt><dd className="mt-1 text-2xl font-bold">{pct(r.totals.occupancy)}</dd></div>
        <div><dt className="text-sm text-muted">ليالٍ محجوزة</dt><dd className="mt-1 text-2xl font-bold">{num(r.totals.nights)}</dd></div>
        <div><dt className="text-sm text-muted">متوسط سعر الليلة</dt><dd className="mt-1 text-2xl font-bold">{money(r.totals.adr)}</dd></div>
      </dl>

      <section className="mb-12">
        <h2 className="mb-1">الإيرادات والمصاريف والإشغال حسب الشهر</h2>
        <p className="mb-4 flex gap-4 text-sm text-muted">
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-palm" />صافي الإيرادات</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-danger/70" />المصاريف</span>
        </p>
        <div className="panel overflow-x-auto p-5">
          <div className="flex min-w-[640px] items-end gap-2" style={{ height: 220 }}>
            {r.months.map((m) => (
              <div key={m.m} className="flex h-full flex-1 flex-col justify-end text-center">
                <span className="mb-1 text-[11px] text-muted">{m.revenue ? num(m.revenue) : ''}</span>
                <div className="mx-auto flex w-full max-w-[44px] items-end gap-0.5">
                  <div
                    className="flex-1 rounded-t-md bg-palm"
                    style={{ height: `${(m.revenue / maxRev) * 150}px`, minHeight: m.revenue ? 3 : 0 }}
                    title={`${monthShort(m.m)}: ${money(m.revenue)}`}
                  />
                  <div
                    className="w-2.5 rounded-t-sm bg-danger/70"
                    style={{ height: `${(m.expenses / maxRev) * 150}px`, minHeight: m.expenses ? 3 : 0 }}
                    title={`مصاريف ${monthShort(m.m)}: ${money(m.expenses)}`}
                  />
                </div>
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
                <tr><th>الوحدة</th><th>الليالي</th><th>الإشغال</th><th>الإيراد</th><th>المصاريف</th><th>الربح</th></tr>
              </thead>
              <tbody>
                {[...r.byUnit].sort((a, b) => b.profit - a.profit).map((u) => (
                  <tr key={u.id}>
                    <td className="font-semibold"><Link href={`/units/${u.id}`} className="hover:text-palm">{u.name}</Link></td>
                    <td>{num(u.nights)}</td>
                    <td>{pct(u.occupancy)}</td>
                    <td>{money(u.revenue)}</td>
                    <td className="text-danger">{money(u.expenses)}</td>
                    <td className={`font-semibold ${u.profit < 0 ? 'text-danger' : ''}`}>{money(u.profit)}</td>
                  </tr>
                ))}
                {r.generalExpenses > 0 && (
                  <tr>
                    <td className="text-muted">مصاريف عامة</td>
                    <td colSpan={3} />
                    <td className="text-danger">{money(r.generalExpenses)}</td>
                    <td />
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {Object.keys(r.byCategory).length > 0 && (
        <section className="mt-10 max-w-xl">
          <h2 className="mb-3">المصاريف حسب البند</h2>
          <ul className="panel divide-y divide-line text-sm">
            {Object.entries(r.byCategory).sort((a, b) => b[1] - a[1]).map(([k, v]) => (
              <li key={k} className="flex items-center justify-between px-4 py-2.5">
                <span>{EXPENSE_CATEGORIES[k] || k}</span>
                <span className="font-semibold">{money(v)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
