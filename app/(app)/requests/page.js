import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { pendingRequests } from '@/lib/queries-v3';
import { rejectRequest } from '@/lib/actions-v3';
import { findOverlaps } from '@/lib/bookings';
import { diffDays, nightsLabel, prettyDate, weekday } from '@/lib/dates';
import { money } from '@/lib/constants';
import { when } from '@/lib/format';
import PageHead from '@/components/PageHead';
import { ConfirmRequestButton } from '@/components/forms-v3';

export const metadata = { title: 'طلبات الحجز | مُضيف' };

export default async function RequestsPage() {
  const user = await requireUser();
  const rows = pendingRequests(user.account_id);
  return (
    <div className="max-w-4xl">
      <PageHead title="طلبات الحجز" sub="طلبات وصلت من صفحة الحجز المباشر وتنتظر تأكيدك.">
        <Link href="/booking-page" className="btn-ghost">إعدادات الصفحة</Link>
      </PageHead>
      {rows.length === 0 ? (
        <div className="panel px-6 py-10 text-center text-muted">
          لا توجد طلبات جديدة. شارك <Link href="/booking-page" className="text-palm underline">رابط صفحة الحجز</Link> مع ضيوفك.
        </div>
      ) : (
        <ul className="space-y-4">
          {rows.map((b) => {
            const clash = findOverlaps(b.unit_id, b.check_in, b.check_out, b.id);
            const phone = (b.guest_phone || '').replace(/\D/g, '').replace(/^0/, '966');
            return (
              <li key={b.id} className="panel p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <Link href={`/bookings/${b.id}`} className="text-lg font-semibold hover:text-palm" dir="auto">{b.guest_name}</Link>
                    <p className="text-muted">
                      {b.unit_name}، {weekday(b.check_in)} {prettyDate(b.check_in)} إلى {prettyDate(b.check_out)} ({nightsLabel(diffDays(b.check_in, b.check_out))})، {b.guests} ضيوف
                    </p>
                    <p className="mt-1">الإجمالي المعروض <strong>{money(b.total_amount)}</strong></p>
                    {b.request_note && <p className="mt-2 rounded bg-paper px-3 py-2 text-sm">"{b.request_note}"</p>}
                    <p className="mt-2 text-xs text-muted">وصل {when(b.created_at)}</p>
                    {clash.length > 0 && <p className="mt-2 text-sm font-semibold text-danger">تنبيه: الوحدة صارت محجوزة في هذه التواريخ.</p>}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <ConfirmRequestButton id={b.id} />
                    {phone && (
                      <a href={`https://wa.me/${phone}`} target="_blank" rel="noreferrer" className="btn-ghost px-3 py-1.5 text-sm" dir="ltr">
                        واتساب {b.guest_phone}
                      </a>
                    )}
                    <details>
                      <summary className="cursor-pointer text-sm text-danger">رفض الطلب</summary>
                      <form action={rejectRequest} className="mt-2 flex gap-2">
                        <input type="hidden" name="id" value={b.id} />
                        <input name="reason" placeholder="السبب (اختياري)" className="field w-44 py-1.5 text-sm" />
                        <button className="btn px-3 py-1.5 text-sm bg-danger text-white hover:bg-danger/90">رفض</button>
                      </form>
                    </details>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
