import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { getGuest } from '@/lib/queries';
import { deleteGuest } from '@/lib/actions-more';
import { diffDays, prettyDate } from '@/lib/dates';
import { money } from '@/lib/constants';
import { GuestForm } from '@/components/forms';
import { SourceTag, StatusTag } from '@/components/badges';
import { ConfirmButton } from '@/components/ui';

export default async function GuestPage({ params }) {
  const user = await requireUser();
  const { id } = await params;
  const g = getGuest(user.account_id, Number(id));
  if (!g) notFound();
  const active = g.bookings.filter((b) => b.status !== 'cancelled');
  const nights = active.reduce((a, b) => a + diffDays(b.check_in, b.check_out), 0);
  const spent = active.reduce((a, b) => a + b.total_amount, 0);

  return (
    <div className="max-w-5xl">
      <Link href="/guests" className="text-sm text-muted hover:text-palm">الضيوف</Link>
      <div className="mb-6 mt-1 flex flex-wrap items-center justify-between gap-3">
        <h1 dir="auto">{g.name}</h1>
        <Link href={`/bookings/new?guest=${g.id}`} className="btn-primary">حجز جديد لهذا الضيف</Link>
      </div>

      <dl className="mb-8 grid grid-cols-3 gap-6 border-y border-line py-4">
        <div><dt className="text-sm text-muted">الإقامات</dt><dd className="text-2xl font-bold">{active.length}</dd></div>
        <div><dt className="text-sm text-muted">الليالي</dt><dd className="text-2xl font-bold">{nights}</dd></div>
        <div><dt className="text-sm text-muted">إجمالي الحجوزات</dt><dd className="text-2xl font-bold">{money(spent)}</dd></div>
      </dl>

      <div className="grid gap-8 lg:grid-cols-[1fr_1fr]">
        <section>
          <h2 className="mb-3">البيانات</h2>
          <div className="panel p-5"><GuestForm guest={g} /></div>
          <form action={deleteGuest} className="mt-4">
            <input type="hidden" name="id" value={g.id} />
            <ConfirmButton message="حذف بيانات الضيف؟ الحجوزات تبقى بدون ربط بالضيف.">حذف الضيف</ConfirmButton>
          </form>
        </section>
        <section>
          <h2 className="mb-3">سجل الإقامات</h2>
          {g.bookings.length === 0 ? (
            <p className="text-muted">لا توجد حجوزات لهذا الضيف.</p>
          ) : (
            <ul className="panel divide-y divide-line">
              {g.bookings.map((b) => (
                <li key={b.id}>
                  <Link href={`/bookings/${b.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-paper/60">
                    <span>
                      <span className="block font-semibold">{b.unit_name}</span>
                      <span className="text-sm text-muted">
                        {prettyDate(b.check_in)} إلى {prettyDate(b.check_out)} {b.check_in.slice(0, 4)}
                      </span>
                    </span>
                    <span className="text-end text-sm">
                      <SourceTag source={b.source} />
                      <span className="mt-1 block">{money(b.total_amount)}</span>
                      {b.status === 'cancelled' && <StatusTag booking={b} />}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
