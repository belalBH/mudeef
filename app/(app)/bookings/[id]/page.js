import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { bookingPayments, bookingTasks, getAccount, getBooking, listGuests, listUnits } from '@/lib/queries';
import { cancelBooking, deleteBooking, deletePayment, restoreBooking, setStayStatus } from '@/lib/actions';
import { toggleTask } from '@/lib/actions-more';
import { deleteInstallment, deleteItem, generateInstallments, rejectRequest } from '@/lib/actions-v3';
import { activity, bookingItems, bookingReview, installmentSchedule } from '@/lib/queries-v3';
import { baseUrl } from '@/lib/baseurl';
import { when } from '@/lib/format';
import { ConfirmRequestButton, DepositForms, InstallmentForm, ItemForm } from '@/components/forms-v3';
import { CopyField } from '@/components/ui';
import { findOverlaps, seasonRates } from '@/lib/bookings';
import { diffDays, prettyDate, todayISO, weekday, nightsLabel } from '@/lib/dates';
import { DEPOSIT_STATUSES, ID_TYPES, ITEM_KINDS, PAYMENT_METHODS, STAY_STATUSES, money, sourceLabel } from '@/lib/constants';
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
  const pending = b.status === 'pending';
  const live = b.status === 'confirmed';
  const base = await baseUrl();
  const guestLink = `${base}/g/${b.guest_token}`;
  const tpls = templatesFor(account);
  const items = bookingItems(b.id);
  const schedule = installmentSchedule(b);
  const review = bookingReview(b.id);
  const log = activity(user.account_id, { bookingId: b.id, limit: 15 });
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
        {live && (
          <span className="rounded bg-paper px-2 py-0.5 text-xs ring-1 ring-line">{STAY_STATUSES[b.stay_status]}</span>
        )}
        <span className="text-sm text-muted">#{b.id}</span>
      </div>
      <p className="mb-5 text-muted">
        {b.unit_name}، {weekday(b.check_in)} {prettyDate(b.check_in)} إلى {weekday(b.check_out)} {prettyDate(b.check_out)} ({nightsLabel(nights)})، <SourceTag source={b.source} />
      </p>

      {sp.saved && <p className="mb-5 rounded-md bg-palm-soft px-4 py-3 text-sm text-palm-dark">تم حفظ الحجز.</p>}
      {pending && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-lg border border-saffron/50 bg-saffron-soft p-4">
          <div>
            <p className="font-semibold">طلب حجز من صفحة الحجز المباشر ينتظر تأكيدك</p>
            {b.request_note && <p className="mt-1 text-sm">ملاحظة الضيف: {b.request_note}</p>}
            <p className="text-sm text-muted">التواريخ غير محجوزة حتى تؤكد الطلب.</p>
          </div>
          <div className="flex flex-wrap items-start gap-2">
            <ConfirmRequestButton id={b.id} />
            <form action={rejectRequest} className="flex gap-2">
              <input type="hidden" name="id" value={b.id} />
              <input name="reason" placeholder="سبب الرفض" aria-label="سبب الرفض" className="field w-36 py-1.5 text-sm" />
              <button className="btn-ghost px-3 py-1.5 text-sm text-danger">رفض</button>
            </form>
          </div>
        </div>
      )}
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
        {live && b.stay_status === 'upcoming' && b.check_in <= today && stayBtn('checked_in', 'تسجيل دخول الضيف', 'btn-primary')}
        {live && b.stay_status === 'upcoming' && b.check_in > today && stayBtn('checked_in', 'تسجيل دخول مبكر')}
        {live && b.stay_status === 'checked_in' &&
          stayBtn('checked_out', inStay && b.check_out > today ? 'خروج مبكر اليوم' : 'تسجيل خروج الضيف', 'btn-primary', inStay && b.check_out > today ? <input type="hidden" name="early" value="1" /> : null)}
        {live && b.stay_status === 'upcoming' && b.check_in <= today && stayBtn('no_show', 'لم يحضر')}
        {live && b.stay_status !== 'upcoming' && stayBtn('upcoming', 'تراجع عن الحالة')}
        <Link href={`/bookings/${b.id}/invoice`} className="btn-ghost">الفاتورة</Link>
        {cancelled ? (
          <form action={restoreBooking}>
            <input type="hidden" name="id" value={b.id} />
            <button className="btn-ghost">استعادة الحجز</button>
          </form>
        ) : pending ? null : (
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

          {/* Extra charges and discounts */}
          <section>
            <h2 className="mb-3">رسوم إضافية وخصومات</h2>
            <div className="panel">
              {items.length > 0 && (
                <ul className="divide-y divide-line">
                  {items.map((it) => (
                    <li key={it.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                      <span>
                        <span className="me-2 rounded bg-paper px-1.5 text-xs ring-1 ring-line">{ITEM_KINDS[it.kind]}</span>
                        {it.label}
                      </span>
                      <span className="flex items-center gap-3">
                        <span className={it.amount < 0 ? 'text-palm' : ''}>{money(it.amount)}</span>
                        <form action={deleteItem}>
                          <input type="hidden" name="id" value={it.id} />
                          <ConfirmButton className="text-xs text-danger hover:underline" message="حذف هذا البند وتعديل الإجمالي؟">حذف</ConfirmButton>
                        </form>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <div className="border-t border-line p-4 first:border-t-0">
                <ItemForm bookingId={b.id} />
                <p className="hint mt-2">يتعدل إجمالي الحجز تلقائياً، ويظهر كل بند في الفاتورة.</p>
              </div>
            </div>
          </section>

          {/* Security deposit */}
          <section>
            <div className="mb-3 flex items-end justify-between">
              <h2>مبلغ التأمين</h2>
              {b.deposit_status !== 'none' && (
                <p className="text-sm">
                  {money(b.security_deposit)}، {DEPOSIT_STATUSES[b.deposit_status]}
                  {b.deposit_status === 'partial' && ` (أُرجع ${money(b.deposit_refunded)})`}
                </p>
              )}
            </div>
            <div className="panel p-4">
              {['refunded', 'partial'].includes(b.deposit_status) ? (
                <p className="text-sm text-muted">تمت تسوية التأمين.{b.deposit_status === 'partial' && ' المبلغ المخصوم أُضيف كبند أضرار ودفعة على الحجز.'}</p>
              ) : (
                <DepositForms booking={b} />
              )}
              <p className="hint mt-2">التأمين لا يدخل في الإيرادات. عند الإرجاع، أي مبلغ تخصمه يُضاف للحجز كأضرار.</p>
            </div>
          </section>

          {/* Installments */}
          <section>
            <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
              <h2>جدول الدفعات</h2>
              {b.total_amount > 0 && (
                <form action={generateInstallments}>
                  <input type="hidden" name="booking_id" value={b.id} />
                  <ConfirmButton className="text-sm text-palm hover:underline" message={schedule.length ? 'استبدال الجدول الحالي بجدول شهري جديد؟' : 'إنشاء جدول دفعات شهرية من إجمالي الحجز؟'}>
                    {schedule.length ? 'إعادة إنشاء جدول شهري' : `تقسيم على ${Math.max(1, Math.ceil(nights / 30))} دفعات شهرية`}
                  </ConfirmButton>
                </form>
              )}
            </div>
            <div className="panel">
              {schedule.length === 0 ? (
                <p className="p-4 text-sm text-muted">مفيد للإقامات الشهرية الطويلة: قسّم المبلغ على دفعات وتابع المتأخر منها في لوحة اليوم.</p>
              ) : (
                <table className="table">
                  <thead><tr><th>الاستحقاق</th><th>المبلغ</th><th>الحالة</th><th>ملاحظة</th><th /></tr></thead>
                  <tbody>
                    {schedule.map((i) => (
                      <tr key={i.id}>
                        <td>{prettyDate(i.due_on)} {i.due_on.slice(0, 4)}</td>
                        <td>{money(i.amount)}</td>
                        <td className={{ paid: 'text-palm', late: 'font-semibold text-danger', due: 'text-saffron', upcoming: 'text-muted' }[i.state]}>
                          {{ paid: 'مدفوعة', late: 'متأخرة', due: 'مستحقة اليوم', upcoming: 'قادمة' }[i.state]}
                          {i.state !== 'paid' && i.paid > 0 && ` (دُفع ${money(i.paid)})`}
                        </td>
                        <td className="text-muted">{i.note}</td>
                        <td className="text-end">
                          <form action={deleteInstallment}>
                            <input type="hidden" name="id" value={i.id} />
                            <button className="text-xs text-danger hover:underline">حذف</button>
                          </form>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <details className="border-t border-line p-4">
                <summary className="cursor-pointer text-sm font-semibold text-palm">إضافة دفعة للجدول يدوياً</summary>
                <div className="mt-3"><InstallmentForm bookingId={b.id} /></div>
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

          <section className="panel p-4">
            <h3 className="mb-2 text-sm font-semibold">صفحة الضيف</h3>
            <p className="mb-3 text-xs text-muted">رابط خاص بهذا الحجز: يشوف منه الضيف تفاصيل حجزه وتعليمات الدخول، ويسجل بياناته، ويقيّم بعد المغادرة.</p>
            <CopyField value={guestLink} />
            <div className="mt-2 flex gap-3 text-sm">
              <a href={guestLink} target="_blank" rel="noreferrer" className="text-palm hover:underline">فتح</a>
              {b.guest_phone && (
                <a href={waLink(b.guest_phone, `أهلاً ${b.guest_name || ''}، هذي صفحة حجزك فيها كل التفاصيل وتسجيل البيانات:\n${guestLink}`)} target="_blank" rel="noreferrer" className="text-palm hover:underline">
                  إرسال للضيف بالواتساب
                </a>
              )}
            </div>
          </section>

          {(b.registered_at || b.arrival_time) && (
            <section className="panel p-4 text-sm">
              <h3 className="mb-2 font-semibold">بيانات النزيل</h3>
              {b.registered_at ? (
                <dl className="space-y-1">
                  <div className="flex justify-between"><dt className="text-muted">الهوية</dt><dd>{ID_TYPES[b.id_type] || '—'}</dd></div>
                  <div className="flex justify-between"><dt className="text-muted">الرقم</dt><dd dir="ltr">{b.id_number}</dd></div>
                  {b.nationality && <div className="flex justify-between"><dt className="text-muted">الجنسية</dt><dd>{b.nationality}</dd></div>}
                  {b.birth_date && <div className="flex justify-between"><dt className="text-muted">الميلاد</dt><dd>{b.birth_date}</dd></div>}
                  {b.arrival_time && <div className="flex justify-between"><dt className="text-muted">الوصول المتوقع</dt><dd>{b.arrival_time}</dd></div>}
                  {b.companions && <div><dt className="text-muted">المرافقون</dt><dd className="whitespace-pre-line">{b.companions}</dd></div>}
                </dl>
              ) : null}
              <p className="mt-2 text-xs text-muted">سجّلها الضيف {when(b.registered_at)}</p>
            </section>
          )}

          {review && (
            <section className="panel p-4 text-sm">
              <h3 className="mb-1 font-semibold">تقييم الضيف</h3>
              <p className="text-lg text-saffron" aria-label={`${review.rating} من 5`}>{'★'.repeat(review.rating)}<span className="text-line">{'★'.repeat(5 - review.rating)}</span></p>
              {review.cleanliness && <p className="text-muted">النظافة {review.cleanliness} من 5</p>}
              {review.comment && <p className="mt-1">"{review.comment}"</p>}
            </section>
          )}

          {b.guest_phone && (
            <section className="panel p-4">
              <h3 className="mb-3 text-sm font-semibold">رسائل واتساب جاهزة</h3>
              <div className="flex flex-col gap-2">
                {Object.entries(tpls).map(([k, t]) => (
                  <a key={k} className="btn-ghost justify-start" href={waLink(b.guest_phone, fillTemplate(t.text, b, account, { guestLink }))} target="_blank" rel="noreferrer">
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

          {log.length > 0 && (
            <section className="panel p-4">
              <h3 className="mb-2 text-sm font-semibold">سجل الحجز</h3>
              <ol className="space-y-1.5 text-xs">
                {log.map((a) => (
                  <li key={a.id}>
                    <span className="font-semibold">{a.user_name || 'النظام'}</span> {a.action}
                    <span className="block text-muted">{when(a.created_at)}</span>
                  </li>
                ))}
              </ol>
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
