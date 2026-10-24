import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { bookingPayments, bookingTasks, getAccount, getBooking, listGuests, listUnits } from '@/lib/queries';
import { cancelBooking, deleteBooking, deletePayment, restoreBooking, setStayStatus } from '@/lib/actions';
import { toggleTask } from '@/lib/actions-more';
import { findOverlaps, seasonRates } from '@/lib/bookings';
import { diffDays, prettyDate, todayISO, weekday, nightsLabel } from '@/lib/dates';
import { PAYMENT_METHODS, STAY_STATUSES, money, sourceLabel } from '@/lib/constants';
import { fillTemplate, templatesFor, waLink } from '@/lib/templates';
import BookingForm from '@/components/BookingForm';
import PaymentForm from '@/components/PaymentForm';
import { SourceTag, StatusTag } from '@/components/badges';
import { ConfirmButton } from '@/components/ui';

export default async function BookingPage({ params, searchParams }) {
  const user = await requireUser();
  const { id } = await params;
  const sp = await searchParams;
  const b = getBooking(user.account_id, Number(id));
  if (!b) notFound();
  const units = listUnits(user.account_id);
  if (b.source === 'block') {
    return (
      <div className="max-w-2xl">
        <Link href={`/units/${b.unit_id}`} className="text-sm text-muted hover:text-palm">{b.unit_name}</Link>
        <h1 className="mb-6 mt-1">إغلاق تواريخ</h1>
        <div className="panel p-5 sm:p-6">
          <BookingForm booking={b} units={units} />
        </div>
        <form action={deleteBooking} className="mt-4">
          <input type="hidden" name="id" value={b.id} />
          <ConfirmButton message="فتح هذه التواريخ للحجز من جديد؟">إلغاء الإغلاق وفتح التواريخ</ConfirmButton>
        </form>
      </div>
    );
  }
  const account = getAccount(user.account_id);
  const payments = bookingPayments(user.account_id, b.id);
  const tasks = bookingTasks(user.account_id, b.id);
  const clashes = b.conflict ? findOverlaps(b.unit_id, b.check_in, b.check_out, b.id) : [];
  const today = todayISO();
  const nights = diffDays(b.check_in, b.check_out);
  const net = b.total_amount - b.commission;
  const due = Math.round((b.total_amount - b.paid_amount) * 100) / 100;
  const cancelled = b.status === 'cancelled';
  const tpls = templatesFor(account);
  const inStay = b.check_in <= today && b.check_out > today;

  const stayBtn = (to, label, cls = 'btn-ghost', extra = null) => (
    <form action={setStayStatus}>
      <input type="hidden" name="id" value={b.id} />
      <input type="hidden" name="to" value={to} />
      {extra}
      <button className={cls}>{label}</button>
    </form>
  );

  return (
    <div className="max-w-6xl">
      <Link href="/bookings" className="text-sm text-muted hover:text-palm">الحجوزات</Link>
      <div className="mb-2 mt-1 flex flex-wrap items-center gap-3">
        <h1>{b.guest_name || 'حجز بدون اسم'}</h1>
        <StatusTag booking={b} />
        {!cancelled && (
          <span className="rounded bg-paper px-2 py-0.5 text-xs ring-1 ring-line">{STAY_STATUSES[b.stay_status]}</span>
        )}
        <span className="text-sm text-muted">#{b.id}</span>
      </div>
      <p className="mb-5 text-muted">
        {b.unit_name}، {weekday(b.check_in)} {prettyDate(b.check_in)} إلى {weekday(b.check_out)} {prettyDate(b.check_out)} ({nightsLabel(nights)})، <SourceTag source={b.source} />
      </p>

      {sp.saved && <p className="mb-5 rounded-md bg-palm-soft px-4 py-3 text-sm text-palm-dark">تم حفظ الحجز.</p>}
      {b.guest_blacklisted ? (
        <p className="mb-5 rounded-md bg-danger-soft px-4 py-3 text-sm text-danger">
          هذا الضيف في قائمة الحظر{b.guest_notes ? `: ${b.guest_notes}` : ''}.
        </p>
      ) : null}
      {cancelled && (
        <p className="mb-5 rounded-md bg-line/50 px-4 py-3 text-sm">
          الحجز ملغي{b.cancel_reason ? `: ${b.cancel_reason}` : ''}. التواريخ مفتوحة للحجز من جديد.
        </p>
      )}

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
          <p className="mt-2 text-muted">انقل أحد الحجزين لوحدة أخرى من نموذج التعديل، أو ألغه من المنصة التي جاء منها.</p>
        </div>
      )}

      {/* Action bar: what can be done with this stay right now */}
      <div className="mb-8 flex flex-wrap gap-2">
        {!cancelled && b.stay_status === 'upcoming' && b.check_in <= today && stayBtn('checked_in', 'تسجيل دخول الضيف', 'btn-primary')}
        {!cancelled && b.stay_status === 'upcoming' && b.check_in > today && stayBtn('checked_in', 'تسجيل دخول مبكر')}
        {!cancelled && b.stay_status === 'checked_in' &&
          stayBtn('checked_out', inStay && b.check_out > today ? 'خروج مبكر اليوم' : 'تسجيل خروج الضيف', 'btn-primary', inStay && b.check_out > today ? <input type="hidden" name="early" value="1" /> : null)}
        {!cancelled && b.stay_status === 'upcoming' && b.check_in <= today && stayBtn('no_show', 'لم يحضر')}
        {!cancelled && b.stay_status !== 'upcoming' && stayBtn('upcoming', 'تراجع عن الحالة')}
        <Link href={`/bookings/${b.id}/invoice`} className="btn-ghost">الفاتورة</Link>
        {cancelled ? (
          <form action={restoreBooking}>
            <input type="hidden" name="id" value={b.id} />
            <button className="btn-ghost">استعادة الحجز</button>
          </form>
        ) : (
          <details className="relative">
            <summary className="btn-ghost cursor-pointer list-none text-danger">إلغاء الحجز</summary>
            <form action={cancelBooking} className="panel absolute end-0 z-10 mt-2 w-72 space-y-2 p-3 shadow-lg">
              <input type="hidden" name="id" value={b.id} />
              <label className="label" htmlFor="reason">سبب الإلغاء</label>
              <input id="reason" name="reason" className="field" placeholder="اختياري" />
              <button className="btn w-full bg-danger text-white hover:bg-danger/90">تأكيد الإلغاء</button>
            </form>
          </details>
        )}
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_300px]">
        <div className="space-y-8">
          {/* Payments */}
          <section>
            <div className="mb-3 flex items-end justify-between">
              <h2>المدفوعات</h2>
              <p className="text-sm">
                المدفوع <strong>{money(b.paid_amount)}</strong> من {money(b.total_amount)}
                {due > 0 ? <span className="ms-2 text-saffron">المتبقي {money(due)}</span> : due < 0 ? <span className="ms-2 text-danger">زيادة {money(-due)}</span> : <span className="ms-2 text-palm">مدفوع بالكامل</span>}
              </p>
            </div>
            <div className="panel">
              {payments.length > 0 && (
                <table className="table">
                  <thead>
                    <tr><th>التاريخ</th><th>الطريقة</th><th>المبلغ</th><th>ملاحظة</th><th /></tr>
                  </thead>
                  <tbody>
                    {payments.map((p) => (
                      <tr key={p.id}>
                        <td>{prettyDate(p.paid_on)}</td>
                        <td>{PAYMENT_METHODS[p.method] || p.method}</td>
                        <td className={p.amount < 0 ? 'text-danger' : ''}>{money(p.amount)}</td>
                        <td className="text-muted">{p.note}</td>
                        <td className="text-end">
                          <form action={deletePayment}>
                            <input type="hidden" name="id" value={p.id} />
                            <ConfirmButton className="text-xs text-danger hover:underline" message="حذف هذه الدفعة؟">حذف</ConfirmButton>
                          </form>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <details className="border-t border-line p-4 first:border-t-0" open={payments.length === 0 && due > 0 && !cancelled}>
                <summary className="cursor-pointer text-sm font-semibold text-palm">تسجيل دفعة</summary>
                <div className="mt-4">
                  <PaymentForm bookingId={b.id} due={due} today={today} defaultMethod={b.source === 'direct' ? 'cash' : 'platform'} />
                </div>
              </details>
            </div>
          </section>

          {/* Edit */}
          <section>
            <h2 className="mb-3">تعديل الحجز</h2>
            <div className="panel p-5 sm:p-6">
              {b.imported ? (
                <p className="mb-5 rounded-md bg-saffron-soft px-3 py-2 text-sm">
                  وصل هذا الحجز من {sourceLabel(b.source)} عبر الربط. التواريخ تتحدث تلقائياً من المنصة، أضف اسم الضيف والمبلغ يدوياً.
                </p>
              ) : null}
              <BookingForm booking={b} units={units} rates={seasonRates(user.account_id)} guests={listGuests(user.account_id)} />
            </div>
          </section>
        </div>

        <aside className="space-y-5">
          <dl className="panel divide-y divide-line text-sm">
            <Row k="الوحدة" v={<Link href={`/units/${b.unit_id}`} className="hover:text-palm">{b.unit_name}</Link>} />
            <Row k="الضيف" v={b.guest_id ? <Link href={`/guests/${b.guest_id}`} className="hover:text-palm">{b.guest_name}</Link> : b.guest_name || '—'} />
            <Row k="عدد الضيوف" v={b.guests} />
            <Row k="الإجمالي" v={money(b.total_amount)} />
            <Row k="العمولة" v={money(b.commission)} />
            <Row k="الصافي لك" v={<strong>{money(net)}</strong>} />
            <Row k="سعر الليلة" v={money(nights ? b.total_amount / nights : 0)} />
            {b.checked_in_at && <Row k="وقت الدخول" v={b.checked_in_at.slice(0, 16)} />}
            {b.checked_out_at && <Row k="وقت الخروج" v={b.checked_out_at.slice(0, 16)} />}
          </dl>

          {b.guest_phone && (
            <section className="panel p-4">
              <h3 className="mb-3 text-sm font-semibold">رسائل واتساب جاهزة</h3>
              <div className="flex flex-col gap-2">
                {Object.entries(tpls).map(([k, t]) => (
                  <a key={k} className="btn-ghost justify-start" href={waLink(b.guest_phone, fillTemplate(t.text, b, account))} target="_blank" rel="noreferrer">
                    {t.label}
                  </a>
                ))}
                <a className="text-xs text-muted hover:text-palm" href={`tel:${b.guest_phone}`} dir="ltr">{b.guest_phone}</a>
              </div>
              <p className="hint mt-2">تعدّل النصوص من الإعدادات.</p>
            </section>
          )}

          {tasks.length > 0 && (
            <section className="panel p-4">
              <h3 className="mb-2 text-sm font-semibold">المهام</h3>
              <ul className="space-y-2 text-sm">
                {tasks.map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-2">
                    <span className={t.status === 'done' ? 'text-muted line-through' : ''}>
                      {t.title} {prettyDate(t.due_on)}
                    </span>
                    <form action={toggleTask}>
                      <input type="hidden" name="id" value={t.id} />
                      <button className="text-xs text-palm hover:underline">{t.status === 'done' ? 'إعادة فتح' : 'تم'}</button>
                    </form>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <form action={deleteBooking}>
            <input type="hidden" name="id" value={b.id} />
            <ConfirmButton message="حذف الحجز نهائياً مع مدفوعاته؟ إذا جاء من منصة سيعود مع المزامنة القادمة، الأفضل إلغاؤه.">
              حذف الحجز نهائياً
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
      <dd className="text-end">{v}</dd>
    </div>
  );
}
