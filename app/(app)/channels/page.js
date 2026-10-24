import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { listChannels, listUnits } from '@/lib/queries';
import { syncNow } from '@/lib/actions';
import { CHANNEL_SOURCES, SOURCES } from '@/lib/constants';
import PageHead from '@/components/PageHead';
import { Submit } from '@/components/ui';

export const metadata = { title: 'ربط المنصات | مُضيف' };

function when(ts) {
  if (!ts) return 'لم تتم';
  return new Date(ts.replace(' ', 'T') + 'Z').toLocaleString('ar-SA-u-ca-gregory-nu-latn', {
    timeZone: 'Asia/Riyadh',
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

export default async function ChannelsPage() {
  const user = await requireUser();
  const units = listUnits(user.account_id);
  const channels = listChannels(user.account_id);
  const map = {};
  for (const c of channels) (map[c.unit_id] ||= {})[c.source] = c;

  return (
    <>
      <PageHead title="ربط المنصات" sub="حالة الربط لكل وحدة مع كل منصة. المزامنة تعمل تلقائياً كل 15 دقيقة.">
        {channels.some((c) => c.import_url) && (
          <form action={syncNow}>
            <Submit className="btn-ghost" pending="جارٍ مزامنة الكل…">مزامنة الكل الآن</Submit>
          </form>
        )}
      </PageHead>

      {units.length === 0 ? (
        <div className="panel px-6 py-10 text-center">
          <p className="text-muted">أضف وحدة أولاً ثم اربطها بالمنصات.</p>
          <Link href="/units/new" className="btn-primary mt-4">إضافة وحدة</Link>
        </div>
      ) : (
        <div className="panel overflow-x-auto">
          <table className="table min-w-[720px]">
            <thead>
              <tr>
                <th>الوحدة</th>
                {CHANNEL_SOURCES.map((s) => (
                  <th key={s}>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full" style={{ background: SOURCES[s].color }} />
                      {SOURCES[s].label}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {units.map((u) => (
                <tr key={u.id}>
                  <td>
                    <Link href={`/units/${u.id}`} className="font-semibold hover:text-palm">{u.name}</Link>
                  </td>
                  {CHANNEL_SOURCES.map((s) => {
                    const c = map[u.id]?.[s];
                    if (!c)
                      return (
                        <td key={s}>
                          <Link href={`/units/${u.id}`} className="text-sm text-muted hover:text-palm">ربط</Link>
                        </td>
                      );
                    const tone =
                      c.last_sync_status === 'error' ? 'text-danger' : c.last_sync_status === 'warning' ? 'text-saffron' : 'text-palm';
                    return (
                      <td key={s} className="text-xs">
                        <div className={`font-semibold ${tone}`}>
                          {!c.import_url ? 'تصدير فقط' : c.last_sync_status === 'error' ? 'خطأ' : c.last_sync_status === 'warning' ? 'يوجد تعارض' : 'يعمل'}
                        </div>
                        <div className="text-muted">آخر مزامنة: {when(c.last_sync_at)}</div>
                        {c.last_sync_status === 'error' && <div className="max-w-[16rem] text-danger">{c.last_sync_message}</div>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <section className="mt-8 max-w-3xl">
        <h2>كيف يعمل الربط</h2>
        <ol className="mt-3 list-decimal space-y-2 ps-5 text-muted">
          <li>من صفحة الوحدة، الصق رابط تقويم المنصة (iCal) فيدخل كل حجز منها إلى مُضيف.</li>
          <li>انسخ رابط مُضيف الخاص بتلك المنصة والصقه في خانة استيراد التقويم عندها، فتُغلق التواريخ المحجوزة من المنصات الأخرى.</li>
          <li>كل 15 دقيقة يقرأ مُضيف التقويمات من جديد، والمنصات تقرأ رابط مُضيف بحسب جدولها (عادة كل ساعة تقريباً).</li>
        </ol>
        <p className="mt-3 text-sm text-muted">
          الربط عبر iCal ينقل التواريخ فقط. الأسعار ورسائل الضيوف تحتاج ربطاً رسمياً عبر API مع كل منصة، وهذه هي المرحلة القادمة.
        </p>
      </section>
    </>
  );
}
