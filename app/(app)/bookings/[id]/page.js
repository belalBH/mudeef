import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { getBooking, listUnits } from '@/lib/queries';
import { deleteBooking } from '@/lib/actions';
import { findOverlaps } from '@/lib/bookings';
import { diffDays, prettyDate } from '@/lib/dates';
import { money, sourceLabel } from '@/lib/constants';
import BookingForm from '@/components/BookingForm';
import { SourceTag, StatusTag } from '@/components/badges';
import { ConfirmButton } from '@/components/ui';

export default async function BookingPage({ params, searchParams }) {
  const user = await requireUser();
  const { id } = await params;
  const sp = await searchParams;
  const b = getBooking(user.account_id, Number(id));
  if (!b) notFound();
  const units = listUnits(user.account_id);
  const clashes = b.conflict ? findOverlaps(b.unit_id, b.check_in, b.check_out, b.id) : [];
  const nights = diffDays(b.check_in, b.check_out);
  const net = b.total_amount - b.commission;
  const due = b.total_amount - b.paid_amount;

  return (
    <div className="max-w-5xl">
      <Link href="/bookings" className="text-sm text-muted hover:text-palm">الحجوزات</Link>
      <div className="mb-6 mt-1 flex flex-wrap items-center gap-3">
        <h1>{b.guest_name || 'حجز بدون اسم'}</h1>
        <StatusTag booking={b} />
      </div>

      {sp.saved && <p className="mb-5 rounded-md bg-palm-soft px-4 py-3 text-sm text-palm-dark">تم حفظ الحجز.</p>}

      {clashes.length > 0 && (
        <div className="mb-6 rounded-lg border border-danger/30 bg-danger-soft p-4 text-sm">
          <p className="font-semibold text-danger">حجز مزدوج على نفس الوحدة</p>
          <ul className="mt-2 space-y-1">
            {clashes.map((c) => (
              <li key={c.id}>
                <Link href={`/bookings/${c.id}`} className="underline underline-offset-2">
                  {c.guest_name || 'حجز'} من {sourceLabel(c.source)}، {prettyDate(c.check_in)} إلى {prettyDate(c.check_out)}
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-muted">انقل أحد الحجزين لوحدة أخرى أو ألغه من المنصة التي جاء منها.</p>
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-[1fr_280px]">
        <div className="panel p-5 sm:p-6">
          {b.imported ? (
            <p className="mb-5 rounded-md bg-saffron-soft px-3 py-2 text-sm">
              هذا الحجز وصل من {sourceLabel(b.source)} عبر الربط. التواريخ تتحدث تلقائياً من المنصة، أضف اسم الضيف والمبلغ يدوياً.
            </p>
          ) : null}
          <BookingForm booking={b} units={units} />
        </div>
        <aside className="space-y-4">
          <dl className="panel divide-y divide-line text-sm">
            <Row k="الوحدة" v={<Link href={`/units/${b.unit_id}`} className="hover:text-palm">{b.unit_name}</Link>} />
            <Row k="المصدر" v={<SourceTag source={b.source} />} />
            <Row k="الإقامة" v={`${prettyDate(b.check_in)} إلى ${prettyDate(b.check_out)}`} />
            <Row k="الليالي" v={nights} />
            <Row k="الإجمالي" v={money(b.total_amount)} />
            <Row k="العمولة" v={money(b.commission)} />
            <Row k="الصافي لك" v={<strong>{money(net)}</strong>} />
            <Row k="المتبقي على الضيف" v={due > 0 ? <span className="text-saffron">{money(due)}</span> : 'مدفوع'} />
          </dl>
          {b.guest_phone && (
            <a
              className="btn-ghost w-full"
              href={`https://wa.me/${b.guest_phone.replace(/\D/g, '').replace(/^0/, '966')}`}
              target="_blank"
              rel="noreferrer"
            >
              مراسلة الضيف على واتساب
            </a>
          )}
          <form action={deleteBooking}>
            <input type="hidden" name="id" value={b.id} />
            <ConfirmButton message="حذف الحجز نهائياً؟ إذا جاء من منصة سيعود مع المزامنة القادمة، الأفضل إلغاؤه من المنصة.">
              حذف الحجز
            </ConfirmButton>
          </form>
        </aside>
      </div>
    </div>
  );
}

function Row({ k, v }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2.5">
      <dt className="text-muted">{k}</dt>
      <dd>{v}</dd>
    </div>
  );
}
