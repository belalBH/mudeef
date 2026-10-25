import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { activity } from '@/lib/queries-v3';
import PageHead from '@/components/PageHead';
import { when } from '@/lib/format';

export const metadata = { title: 'سجل النشاط | مُضيف' };

export default async function ActivityPage() {
  const user = await requireUser();
  const rows = activity(user.account_id, { limit: 300 });
  return (
    <div className="max-w-4xl">
      <PageHead title="سجل النشاط" sub="كل تعديل على الحجوزات والدفعات والوحدات، ومن سوّاه." />
      {rows.length === 0 ? (
        <div className="panel px-6 py-10 text-center text-muted">لا يوجد نشاط مسجل بعد.</div>
      ) : (
        <ol className="panel divide-y divide-line">
          {rows.map((a) => (
            <li key={a.id} className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-2.5 text-sm">
              <span>
                <strong className="font-semibold">{a.user_name || 'النظام'}</strong> {a.action}
                {a.booking_id && (
                  <Link href={`/bookings/${a.booking_id}`} className="ms-2 text-xs text-palm hover:underline">#{a.booking_id}</Link>
                )}
              </span>
              <time className="text-xs text-muted">{when(a.created_at)}</time>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
