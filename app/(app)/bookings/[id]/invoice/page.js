import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { bookingPayments, getAccount, getBooking } from '@/lib/queries';
import { diffDays, nightsLabel, prettyDate, todayISO } from '@/lib/dates';
import { PAYMENT_METHODS, money, sourceLabel } from '@/lib/constants';
import PrintButton from '@/components/PrintButton';

export const metadata = { title: 'فاتورة | مُضيف' };

const VAT = 0.15;

export default async function InvoicePage({ params }) {
  const user = await requireUser();
  const { id } = await params;
  const b = getBooking(user.account_id, Number(id));
  if (!b || b.source === 'block') notFound();
  const acc = getAccount(user.account_id);
  const payments = bookingPayments(user.account_id, b.id);
  const nights = diffDays(b.check_in, b.check_out);
  const vatOn = !!acc.vat_number;
  const vat = vatOn ? (b.total_amount * VAT) / (1 + VAT) : 0;
  const due = b.total_amount - b.paid_amount;
  const number = `INV-${b.check_in.slice(0, 4)}-${String(b.id).padStart(5, '0')}`;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-5 flex items-center justify-between print:hidden">
        <Link href={`/bookings/${b.id}`} className="text-sm text-muted hover:text-palm">الرجوع للحجز</Link>
        <PrintButton />
      </div>

      <article className="panel p-8 print:border-0 print:p-0">
        <header className="flex flex-wrap items-start justify-between gap-6 border-b border-line pb-6">
          <div>
            <h1 className="text-2xl">{acc.name}</h1>
            {acc.address && <p className="mt-1 text-sm text-muted">{acc.address}</p>}
            {acc.phone && <p className="text-sm text-muted" dir="ltr">{acc.phone}</p>}
            {vatOn && <p className="mt-1 text-sm">الرقم الضريبي: {acc.vat_number}</p>}
          </div>
          <div className="text-end">
            <p className="text-lg font-bold">{vatOn ? 'فاتورة ضريبية مبسطة' : 'فاتورة'}</p>
            <p className="text-sm text-muted">رقم {number}</p>
            <p className="text-sm text-muted">التاريخ {prettyDate(todayISO())} {todayISO().slice(0, 4)}</p>
            {b.cancel_reason || b.status === 'cancelled' ? <p className="mt-1 text-sm font-semibold text-danger">حجز ملغي</p> : null}
          </div>
        </header>

        <section className="grid gap-4 border-b border-line py-6 text-sm sm:grid-cols-2">
          <div>
            <p className="text-muted">الضيف</p>
            <p className="font-semibold">{b.guest_name || '—'}</p>
            {b.guest_phone && <p dir="ltr" className="text-end sm:text-start">{b.guest_phone}</p>}
          </div>
          <div>
            <p className="text-muted">الإقامة</p>
            <p className="font-semibold">{b.unit_name}</p>
            <p>
              {prettyDate(b.check_in)} إلى {prettyDate(b.check_out)} {b.check_out.slice(0, 4)}، {nightsLabel(nights)}
            </p>
            <p className="text-muted">المصدر: {sourceLabel(b.source)}</p>
          </div>
        </section>

        <table className="table my-4">
          <thead>
            <tr><th>البيان</th><th>الكمية</th><th>سعر الليلة</th><th className="text-end">المبلغ</th></tr>
          </thead>
          <tbody>
            <tr>
              <td>إقامة في {b.unit_name}</td>
              <td>{nights}</td>
              <td>{money(nights ? b.total_amount / nights : 0)}</td>
              <td className="text-end">{money(b.total_amount)}</td>
            </tr>
          </tbody>
        </table>

        <dl className="ms-auto w-full max-w-xs space-y-1.5 text-sm">
          {vatOn && (
            <>
              <div className="flex justify-between"><dt className="text-muted">المبلغ قبل الضريبة</dt><dd>{money(b.total_amount - vat)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">ضريبة القيمة المضافة 15%</dt><dd>{money(vat)}</dd></div>
            </>
          )}
          <div className="flex justify-between border-t border-line pt-1.5 font-bold"><dt>الإجمالي</dt><dd>{money(b.total_amount)}</dd></div>
          <div className="flex justify-between"><dt className="text-muted">المدفوع</dt><dd>{money(b.paid_amount)}</dd></div>
          <div className="flex justify-between font-semibold"><dt>المتبقي</dt><dd>{money(Math.max(0, due))}</dd></div>
        </dl>

        {payments.length > 0 && (
          <section className="mt-8">
            <h2 className="mb-2 text-sm font-semibold">سجل الدفعات</h2>
            <ul className="text-sm text-muted">
              {payments.map((p) => (
                <li key={p.id}>
                  {prettyDate(p.paid_on)}: {money(p.amount)} ({PAYMENT_METHODS[p.method] || p.method})
                </li>
              ))}
            </ul>
          </section>
        )}

        {acc.invoice_note && <p className="mt-8 whitespace-pre-line border-t border-line pt-4 text-sm text-muted">{acc.invoice_note}</p>}
      </article>
      {!vatOn && (
        <p className="mt-3 text-xs text-muted print:hidden">
          لإظهار الضريبة أضف الرقم الضريبي من <Link href="/settings" className="underline">الإعدادات</Link>. هذه الفاتورة للعرض والطباعة، وليست مربوطة بمنصة فاتورة لهيئة الزكاة.
        </p>
      )}
    </div>
  );
}
