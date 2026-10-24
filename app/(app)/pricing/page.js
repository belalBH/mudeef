import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { listSeasons, listUnits } from '@/lib/queries';
import { deleteSeason } from '@/lib/actions-more';
import { diffDays, prettyDate, todayISO } from '@/lib/dates';
import { UNIT_TYPES, money } from '@/lib/constants';
import PageHead from '@/components/PageHead';
import { SeasonForm } from '@/components/forms';
import { ConfirmButton } from '@/components/ui';

export const metadata = { title: 'الأسعار والمواسم | مُضيف' };

export default async function PricingPage() {
  const user = await requireUser();
  const units = listUnits(user.account_id);
  const seasons = listSeasons(user.account_id);
  const today = todayISO();

  return (
    <>
      <PageHead title="الأسعار والمواسم" sub="حدد أسعاراً خاصة لفترات معينة. السعر المحسوب في كل حجز يأخذها تلقائياً." />

      <section className="mb-10">
        <h2 className="mb-3">الأسعار الأساسية</h2>
        <div className="panel overflow-x-auto">
          <table className="table min-w-[560px]">
            <thead>
              <tr><th>الوحدة</th><th>النوع</th><th>سعر الليلة</th><th>الخميس والجمعة</th><th /></tr>
            </thead>
            <tbody>
              {units.map((u) => (
                <tr key={u.id}>
                  <td className="font-semibold">{u.name}</td>
                  <td>{UNIT_TYPES[u.type]}</td>
                  <td>{money(u.base_price)}</td>
                  <td>{u.weekend_price ? money(u.weekend_price) : <span className="text-muted">نفس السعر</span>}</td>
                  <td className="text-end"><Link href={`/units/${u.id}`} className="text-xs text-palm hover:underline">تعديل</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-10">
        <h2 className="mb-3">موسم جديد</h2>
        <div className="panel p-5"><SeasonForm units={units} /></div>
      </section>

      <section>
        <h2 className="mb-3">المواسم</h2>
        {seasons.length === 0 ? (
          <p className="text-muted">لا توجد مواسم بعد. أضف مثلاً موسم الحج أو إجازة الصيف بسعر أعلى.</p>
        ) : (
          <div className="space-y-3">
            {seasons.map((s) => {
              const past = s.end_on < today;
              const live = s.start_on <= today && s.end_on >= today;
              return (
                <details key={s.id} className={`panel ${past ? 'opacity-60' : ''}`}>
                  <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-3 px-5 py-3">
                    <span>
                      <span className="font-semibold">{s.name}</span>
                      {live && <span className="ms-2 rounded bg-palm-soft px-1.5 text-xs text-palm-dark">ساري الآن</span>}
                      {past && <span className="ms-2 text-xs text-muted">انتهى</span>}
                      <span className="block text-sm text-muted">
                        {prettyDate(s.start_on)} إلى {prettyDate(s.end_on)} {s.end_on.slice(0, 4)} ({diffDays(s.start_on, s.end_on) + 1} ليلة)، {s.unit_name || 'كل الوحدات'}
                        {s.min_nights > 1 && `، أقل حجز ${s.min_nights} ليالٍ`}
                      </span>
                    </span>
                    <span className="text-end">
                      <strong>{money(s.price)}</strong>
                      {s.weekend_price && <span className="block text-xs text-muted">الخميس والجمعة {money(s.weekend_price)}</span>}
                    </span>
                  </summary>
                  <div className="border-t border-line p-5">
                    <SeasonForm units={units} season={s} />
                    <form action={deleteSeason} className="mt-3">
                      <input type="hidden" name="id" value={s.id} />
                      <ConfirmButton message={`حذف موسم ${s.name}؟`}>حذف الموسم</ConfirmButton>
                    </form>
                  </div>
                </details>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}
