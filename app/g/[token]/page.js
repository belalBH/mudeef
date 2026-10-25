import { notFound } from 'next/navigation';
import { bookingByToken, bookingReview } from '@/lib/queries-v3';
import { addDays, diffDays, nightsLabel, prettyDate, todayISO, weekday } from '@/lib/dates';
import { ID_TYPES, money } from '@/lib/constants';
import { RegisterForm, ReviewForm } from '@/components/forms-v3';
import { CopyField } from '@/components/ui';
import Logo from '@/components/Logo';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'حجزك', robots: { index: false, follow: false } };

export default async function GuestPage({ params, searchParams }) {
  const { token } = await params;
  const sp = await searchParams;
  const b = bookingByToken(token);
  if (!b || b.source === 'block') notFound();
  const today = todayISO();
  const nights = diffDays(b.check_in, b.check_out);
  const due = Math.max(0, b.total_amount - b.paid_amount);
  const confirmed = b.status === 'confirmed';
  const over = b.check_out <= today || b.stay_status === 'checked_out';
  // Door codes and Wi-Fi are shown from the day before arrival
  const showAccess = confirmed && !over && today >= addDays(b.check_in, -1);
  const review = confirmed && over ? bookingReview(b.id) : null;
  // Only these fields go to the browser form; door codes and Wi-Fi stay on the server until shown above
  const formData = {
    guest_name: b.guest_name, id_type: b.id_type, nationality: b.nationality, birth_date: b.birth_date,
    guests: b.guests, arrival_time: b.arrival_time, companions: b.companions,
  };
  const hostWa = b.account_phone ? `https://wa.me/${b.account_phone.replace(/\D/g, '').replace(/^0/, '966')}` : null;

  return (
    <div className="min-h-screen bg-paper">
      <header className="bg-palm-dark text-white">
        <div className="mx-auto max-w-2xl px-4 py-6">
          <p className="text-white/70">{b.account_name}</p>
          <h1 className="mt-1">أهلاً {b.guest_name || 'بك'}</h1>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-6 px-4 py-6">
        {sp.new && b.status === 'pending' && (
          <p role="status" className="rounded-md bg-palm-soft px-4 py-3 text-palm-dark">
            وصل طلبك. احفظ هذه الصفحة لتتابع حالته، وسيتواصل معك المضيف للتأكيد.
          </p>
        )}
        <section className={`rounded-lg p-4 ${b.status === 'pending' ? 'bg-saffron-soft' : b.status === 'cancelled' ? 'bg-danger-soft' : 'bg-white ring-1 ring-line'}`}>
          <p className="text-sm text-muted">حالة الحجز</p>
          <p className="text-xl font-bold">
            {b.status === 'pending' && 'بانتظار تأكيد المضيف'}
            {b.status === 'cancelled' && 'الحجز ملغي'}
            {confirmed && (over ? 'انتهت الإقامة، نتمنى أنها كانت ممتعة' : b.stay_status === 'checked_in' ? 'إقامة سعيدة' : 'الحجز مؤكد')}
          </p>
          {b.status === 'cancelled' && b.cancel_reason && <p className="mt-1 text-sm">{b.cancel_reason}</p>}
        </section>

        <section className="panel p-5">
          <h2 className="mb-3">{b.unit_name}</h2>
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-muted">الوصول</dt>
              <dd className="font-semibold">{weekday(b.check_in)} {prettyDate(b.check_in)}</dd>
              <dd className="text-muted">من الساعة {b.checkin_time || '15:00'}</dd>
            </div>
            <div>
              <dt className="text-muted">المغادرة</dt>
              <dd className="font-semibold">{weekday(b.check_out)} {prettyDate(b.check_out)}</dd>
              <dd className="text-muted">قبل الساعة {b.checkout_time || '12:00'}</dd>
            </div>
            <div>
              <dt className="text-muted">المدة</dt>
              <dd>{nightsLabel(nights)}، {b.guests} ضيوف</dd>
            </div>
            <div>
              <dt className="text-muted">المبلغ</dt>
              <dd>{money(b.total_amount)}</dd>
              {b.status !== 'cancelled' && (due > 0 ? <dd className="text-saffron">المتبقي {money(due)}</dd> : b.total_amount > 0 && <dd className="text-palm">مدفوع</dd>)}
            </div>
          </dl>
          {b.map_url && (
            <a href={b.map_url} target="_blank" rel="noreferrer" className="btn-ghost mt-4">الموقع على الخريطة</a>
          )}
        </section>

        {showAccess && (b.checkin_info || b.wifi_name) && (
          <section className="panel p-5">
            <h2 className="mb-3">تعليمات الدخول</h2>
            {b.checkin_info && <p className="whitespace-pre-line leading-relaxed">{b.checkin_info}</p>}
            {b.wifi_name && (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="label">شبكة الواي فاي</p>
                  <p dir="auto" className="font-semibold">{b.wifi_name}</p>
                </div>
                {b.wifi_password && <CopyField label="كلمة المرور" value={b.wifi_password} />}
              </div>
            )}
          </section>
        )}
        {confirmed && !over && !showAccess && (b.checkin_info || b.wifi_name) && (
          <p className="text-sm text-muted">تعليمات الدخول ورمز الباب تظهر هنا قبل وصولك بيوم.</p>
        )}

        {b.house_rules && b.status !== 'cancelled' && (
          <section className="panel p-5">
            <h2 className="mb-2">قوانين السكن</h2>
            <p className="whitespace-pre-line text-sm leading-relaxed">{b.house_rules}</p>
          </section>
        )}

        {confirmed && !over && (
          <section className="panel p-5">
            <h2 className="mb-1">تسجيل بيانات النزيل</h2>
            {b.registered_at ? (
              <>
                <p className="mb-3 text-sm text-palm">
                  تم تسجيل بياناتك ({ID_TYPES[b.id_type] || 'هوية'} تنتهي بـ {String(b.id_number || '').slice(-4)}). تقدر تعدّلها من هنا.
                </p>
                <details>
                  <summary className="cursor-pointer text-sm text-palm">تعديل البيانات</summary>
                  <div className="mt-4"><RegisterForm token={token} booking={formData} /></div>
                </details>
              </>
            ) : (
              <>
                <p className="mb-4 text-sm text-muted">أكمل بياناتك قبل الوصول ليكون الدخول أسرع.</p>
                <RegisterForm token={token} booking={formData} />
              </>
            )}
          </section>
        )}

        {confirmed && over && (
          <section className="panel p-5">
            <h2 className="mb-3">قيّم إقامتك</h2>
            {review ? (
              <p className="text-palm">شكراً لتقييمك: {'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</p>
            ) : (
              <ReviewForm token={token} />
            )}
          </section>
        )}

        {hostWa && (
          <a href={hostWa} target="_blank" rel="noreferrer" className="btn-primary w-full py-3">تواصل مع المضيف على واتساب</a>
        )}
        <div className="pt-4 opacity-60"><Logo /></div>
      </main>
    </div>
  );
}
