import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { getAccount, listUnits } from '@/lib/queries';
import { coverPhotos } from '@/lib/queries-v3';
import { baseUrl } from '@/lib/baseurl';
import PageHead from '@/components/PageHead';
import { BookingPageForm } from '@/components/forms-v3';
import { CopyField } from '@/components/ui';

export const metadata = { title: 'صفحة الحجز المباشر | مُضيف' };

export default async function BookingPageSettings() {
  const user = await requireUser();
  const account = getAccount(user.account_id);
  const base = await baseUrl();
  const units = listUnits(user.account_id, { activeOnly: true });
  const covers = coverPhotos(user.account_id);
  const link = `${base}/book/${account.slug}`;
  const owner = user.role === 'owner';

  return (
    <div className="max-w-4xl">
      <PageHead title="صفحة الحجز المباشر" sub="صفحة عامة يحجز منها الضيوف عندك مباشرة بدون عمولة المنصات. ترسل رابطها في واتساب أو انستقرام." />

      {account.booking_enabled ? (
        <div className="panel mb-8 p-5">
          <CopyField label="رابط صفحتك" value={link} />
          <div className="mt-3 flex flex-wrap gap-2">
            <a href={link} target="_blank" rel="noreferrer" className="btn-ghost">فتح الصفحة</a>
            <a href={`https://wa.me/?text=${encodeURIComponent(`احجز عندنا مباشرة: ${link}`)}`} target="_blank" rel="noreferrer" className="btn-ghost">مشاركة على واتساب</a>
          </div>
        </div>
      ) : (
        <p className="mb-8 rounded-md bg-saffron-soft px-4 py-3 text-sm">الصفحة غير مفعلة. فعّلها من الأسفل لتبدأ باستقبال الطلبات.</p>
      )}

      <div className="grid gap-8 lg:grid-cols-[1fr_1fr]">
        <section>
          <h2 className="mb-3">الإعدادات</h2>
          <div className="panel p-5">
            {owner ? <BookingPageForm account={account} url={base} /> : <p className="text-sm text-muted">مالك الحساب فقط يعدّل إعدادات الصفحة.</p>}
          </div>
        </section>
        <section>
          <h2 className="mb-3">كيف تعمل</h2>
          <ol className="list-decimal space-y-2 ps-5 text-sm text-muted">
            <li>الضيف يختار التواريخ ويشوف الوحدات المتاحة بأسعارها، والسعر يحسب المواسم تلقائياً.</li>
            <li>يرسل طلب الحجز باسمه وجواله، ويوصلك في <Link href="/requests" className="text-palm underline">طلبات الحجز</Link>.</li>
            <li>تأكد الطلب أو ترفضه. الضيف يتابع الحالة من رابطه الخاص، ومنه يسجل بياناته ويشوف تعليمات الدخول.</li>
            <li>الدفع يكون بالطريقة اللي تتفق عليها مع الضيف، وتسجله في صفحة الحجز.</li>
          </ol>
          <h3 className="mb-2 mt-6 font-semibold">الوحدات الظاهرة في الصفحة</h3>
          <ul className="space-y-2 text-sm">
            {units.map((u) => (
              <li key={u.id} className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2">
                  {covers[u.id] ? (
                    <img src={`/api/files/${covers[u.id]}`} alt="" className="h-8 w-10 rounded object-cover" />
                  ) : (
                    <span className="h-8 w-10 rounded bg-line" title="بدون صورة" />
                  )}
                  <Link href={`/units/${u.id}`} className="hover:text-palm">{u.name}</Link>
                </span>
                <span className={u.public ? 'text-palm' : 'text-muted'}>{u.public ? 'ظاهرة' : 'مخفية'}</span>
              </li>
            ))}
          </ul>
          <p className="hint mt-2">أضف صوراً ووصفاً من صفحة كل وحدة لتظهر بشكل أفضل.</p>
        </section>
      </div>
    </div>
  );
}
