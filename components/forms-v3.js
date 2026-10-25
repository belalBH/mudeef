'use client';

import { useEffect, useRef, useState } from 'react';
import {
  addInstallment, addItem, addMember, confirmRequest, createRequest, receiveDeposit, registerGuest, resetMemberPassword,
  saveBookingPage, saveOwner, saveRecurring, settleDeposit, submitReview, uploadPhotos,
} from '@/lib/actions-v3';
import { EXPENSE_CATEGORIES, ID_TYPES, ITEM_KINDS } from '@/lib/constants';
import { Alert, Submit, useFormAction } from './ui';

function useForm(action, { reset = true } = {}) {
  const [state, onSubmit, busy] = useFormAction(action);
  const ref = useRef(null);
  useEffect(() => {
    if (state?.ok && reset) ref.current?.reset();
  }, [state, reset]);
  return { state, onSubmit, busy, ref, v: state?.values || {} };
}

const ROLE_HELP = {
  manager: 'يدير كل شي ما عدا الفريق والنسخ الاحتياطي.',
  cleaner: 'يشوف مهام التنظيف والصيانة فقط ويعلّمها كمنجزة.',
  owner: 'صلاحية كاملة مثلك.',
};

export function MemberForm() {
  const { state, onSubmit, busy, ref, v } = useForm(addMember);
  const [role, setRole] = useState('cleaner');
  return (
    <form ref={ref} onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
      <div>
        <label className="label" htmlFor="mname">الاسم</label>
        <input id="mname" name="name" className="field" defaultValue={v.name} required />
      </div>
      <div>
        <label className="label" htmlFor="mphone">الجوال</label>
        <input id="mphone" name="phone" dir="ltr" className="field text-start" defaultValue={v.phone} />
      </div>
      <div>
        <label className="label" htmlFor="memail">البريد (اسم الدخول)</label>
        <input id="memail" name="email" type="email" dir="ltr" className="field text-start" defaultValue={v.email} required />
      </div>
      <div>
        <label className="label" htmlFor="mpass">كلمة مرور مؤقتة</label>
        <input id="mpass" name="password" type="text" dir="ltr" className="field text-start" minLength={8} autoComplete="off" required />
      </div>
      <div className="sm:col-span-2">
        <label className="label" htmlFor="mrole">الصلاحية</label>
        <select id="mrole" name="role" className="field" value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="cleaner">عامل نظافة وصيانة</option>
          <option value="manager">مدير</option>
          <option value="owner">مالك</option>
        </select>
        <p className="hint">{ROLE_HELP[role]}</p>
      </div>
      <div className="sm:col-span-2">
        <Alert state={state} />
        <div className="mt-2"><Submit busy={busy}>إضافة للفريق</Submit></div>
      </div>
    </form>
  );
}

export function ResetPasswordForm({ id }) {
  const { state, onSubmit, busy, ref } = useForm(resetMemberPassword);
  return (
    <form ref={ref} onSubmit={onSubmit} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="id" value={id} />
      <div>
        <label className="label text-xs" htmlFor={`rp${id}`}>كلمة مرور جديدة</label>
        <input id={`rp${id}`} name="password" type="text" dir="ltr" minLength={8} className="field w-44 py-1.5 text-sm" autoComplete="off" required />
      </div>
      <Submit busy={busy} className="btn-ghost px-3 py-1.5 text-xs">تغيير</Submit>
      <div className="w-full"><Alert state={state} /></div>
    </form>
  );
}

export function PhotoUpload({ unitId }) {
  const { state, onSubmit, busy, ref } = useForm(uploadPhotos);
  return (
    <form ref={ref} onSubmit={onSubmit} className="space-y-2">
      <input type="hidden" name="unit_id" value={unitId} />
      <label className="label" htmlFor="photos">إضافة صور</label>
      <input
        id="photos"
        name="photos"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="block w-full text-sm file:me-3 file:rounded-md file:border-0 file:bg-palm-soft file:px-3 file:py-2 file:text-sm file:font-semibold file:text-palm-dark"
      />
      <p className="hint">JPG أو PNG أو WebP، حتى 6 ميجا للصورة. أول صورة هي الغلاف في صفحة الحجز.</p>
      <Alert state={state} />
      <Submit busy={busy} pending="جارٍ الرفع…">رفع الصور</Submit>
    </form>
  );
}

export function ConfirmRequestButton({ id }) {
  const [state, onSubmit, busy] = useFormAction(confirmRequest);
  return (
    <form onSubmit={onSubmit} className="inline-block">
      <input type="hidden" name="id" value={id} />
      <Submit busy={busy} className="btn-primary px-3 py-1.5 text-sm" pending="جارٍ التأكيد…">تأكيد الحجز</Submit>
      {state?.error && <p role="alert" className="mt-1 max-w-xs text-xs text-danger">{state.error}</p>}
    </form>
  );
}

export function ItemForm({ bookingId }) {
  const { state, onSubmit, busy, ref, v } = useForm(addItem);
  const [kind, setKind] = useState('fee');
  return (
    <form ref={ref} onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-[auto_1fr_8rem_auto] sm:items-end">
      <input type="hidden" name="booking_id" value={bookingId} />
      <div>
        <label className="label" htmlFor="ikind">النوع</label>
        <select id="ikind" name="kind" className="field" value={kind} onChange={(e) => setKind(e.target.value)}>
          {Object.entries(ITEM_KINDS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="ilabel">الوصف</label>
        <input
          id="ilabel"
          name="label"
          className="field"
          defaultValue={v.label}
          placeholder={{ fee: 'رسوم تنظيف', extra: 'سرير إضافي، دخول مبكر', discount: 'خصم عميل متكرر', damage: 'كسر كوب' }[kind]}
        />
      </div>
      <div>
        <label className="label" htmlFor="iamount">المبلغ</label>
        <input id="iamount" name="amount" type="number" min="0" step="0.01" className="field" defaultValue={v.amount} required />
      </div>
      <Submit busy={busy} className={kind === 'discount' ? 'btn-ghost' : 'btn-primary'}>{kind === 'discount' ? 'تطبيق الخصم' : 'إضافة'}</Submit>
      <div className="sm:col-span-4"><Alert state={state} /></div>
    </form>
  );
}

export function DepositForms({ booking }) {
  const recv = useForm(receiveDeposit);
  const settle = useForm(settleDeposit);
  if (booking.deposit_status === 'held') {
    return (
      <form ref={settle.ref} onSubmit={settle.onSubmit} className="grid gap-3 sm:grid-cols-[8rem_1fr_auto] sm:items-end">
        <input type="hidden" name="booking_id" value={booking.id} />
        <div>
          <label className="label" htmlFor="refund">المبلغ المُرجع</label>
          <input id="refund" name="refund" type="number" min="0" max={booking.security_deposit} step="0.01" className="field" defaultValue={booking.security_deposit} />
        </div>
        <div>
          <label className="label" htmlFor="dreason">سبب الخصم (إن وجد)</label>
          <input id="dreason" name="reason" className="field" placeholder="أضرار، فقدان مفتاح…" />
        </div>
        <Submit busy={settle.busy}>إرجاع التأمين</Submit>
        <div className="sm:col-span-3"><Alert state={settle.state} /></div>
      </form>
    );
  }
  return (
    <form ref={recv.ref} onSubmit={recv.onSubmit} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="booking_id" value={booking.id} />
      <div>
        <label className="label" htmlFor="damount">مبلغ التأمين</label>
        <input id="damount" name="amount" type="number" min="0" step="0.01" className="field w-36" required />
      </div>
      <Submit busy={recv.busy} className="btn-ghost">تسجيل استلام التأمين</Submit>
      <div className="w-full"><Alert state={recv.state} /></div>
    </form>
  );
}

export function InstallmentForm({ bookingId }) {
  const { state, onSubmit, busy, ref, v } = useForm(addInstallment);
  return (
    <form ref={ref} onSubmit={onSubmit} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="booking_id" value={bookingId} />
      <div>
        <label className="label" htmlFor="idue">تاريخ الاستحقاق</label>
        <input id="idue" name="due_on" type="date" className="field" defaultValue={v.due_on} required />
      </div>
      <div>
        <label className="label" htmlFor="iamt">المبلغ</label>
        <input id="iamt" name="amount" type="number" min="0" step="0.01" className="field w-32" defaultValue={v.amount} required />
      </div>
      <div className="flex-1">
        <label className="label" htmlFor="inote">ملاحظة</label>
        <input id="inote" name="note" className="field" defaultValue={v.note} />
      </div>
      <Submit busy={busy} className="btn-ghost">إضافة دفعة للجدول</Submit>
      <div className="w-full"><Alert state={state} /></div>
    </form>
  );
}

export function OwnerForm({ owner }) {
  const o = owner || {};
  const { state, onSubmit, busy, ref, v } = useForm(saveOwner, { reset: false });
  const f = (k, d = '') => v[k] ?? o[k] ?? d;
  return (
    <form ref={ref} onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
      {o.id && <input type="hidden" name="id" value={o.id} />}
      <div>
        <label className="label" htmlFor="oname">اسم المالك</label>
        <input id="oname" name="name" className="field" defaultValue={f('name')} required />
      </div>
      <div>
        <label className="label" htmlFor="ofee">نسبة الإدارة %</label>
        <input id="ofee" name="fee_pct" type="number" min="0" max="100" step="0.5" className="field" defaultValue={f('fee_pct', 20)} />
        <p className="hint">تُحسب من صافي الإيراد بعد عمولات المنصات.</p>
      </div>
      <div>
        <label className="label" htmlFor="ophone">الجوال</label>
        <input id="ophone" name="phone" dir="ltr" className="field text-start" defaultValue={f('phone')} />
      </div>
      <div>
        <label className="label" htmlFor="oemail">البريد</label>
        <input id="oemail" name="email" type="email" dir="ltr" className="field text-start" defaultValue={f('email')} />
      </div>
      <div className="sm:col-span-2">
        <label className="label" htmlFor="oiban">الآيبان لتحويل المستحقات</label>
        <input id="oiban" name="iban" dir="ltr" className="field text-start font-mono" defaultValue={f('iban')} placeholder="SA0000000000000000000000" />
      </div>
      <div className="sm:col-span-2">
        <label className="label" htmlFor="onotes">ملاحظات</label>
        <textarea id="onotes" name="notes" rows={2} className="field" defaultValue={f('notes')} />
      </div>
      <div className="sm:col-span-2">
        <Alert state={state} />
        <div className="mt-2"><Submit busy={busy}>{o.id ? 'حفظ' : 'إضافة المالك'}</Submit></div>
      </div>
    </form>
  );
}

export function RecurringForm({ units }) {
  const { state, onSubmit, busy, ref, v } = useForm(saveRecurring);
  return (
    <form ref={ref} onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 lg:items-end">
      <div>
        <label className="label" htmlFor="ramount">المبلغ الشهري</label>
        <input id="ramount" name="amount" type="number" min="0" step="0.01" className="field" defaultValue={v.amount} required />
      </div>
      <div>
        <label className="label" htmlFor="rcat">البند</label>
        <select id="rcat" name="category" className="field" defaultValue={v.category || 'utilities'}>
          {Object.entries(EXPENSE_CATEGORIES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="runit">الوحدة</label>
        <select id="runit" name="unit_id" className="field" defaultValue={v.unit_id || ''}>
          <option value="">عام</option>
          {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="rday">يوم التسجيل في الشهر</label>
        <input id="rday" name="day_of_month" type="number" min="1" max="28" className="field" defaultValue={v.day_of_month || 1} />
      </div>
      <div>
        <label className="label" htmlFor="rnote">الوصف</label>
        <input id="rnote" name="note" className="field" defaultValue={v.note} placeholder="إيجار، إنترنت، راتب…" />
      </div>
      <label className="flex items-center gap-2 text-sm lg:col-span-4">
        <input type="checkbox" name="add_now" className="h-4 w-4 accent-palm" />
        سجّل مصروف هذا الشهر الآن أيضاً
      </label>
      <Submit busy={busy}>إضافة مصروف شهري</Submit>
      <div className="sm:col-span-2 lg:col-span-5"><Alert state={state} /></div>
    </form>
  );
}

export function BookingPageForm({ account, url }) {
  const { state, onSubmit, busy, ref, v } = useForm(saveBookingPage, { reset: false });
  return (
    <form ref={ref} onSubmit={onSubmit} className="space-y-4">
      <label className="flex items-center gap-2 font-semibold">
        <input type="checkbox" name="booking_enabled" defaultChecked={!!(v.booking_enabled ?? account.booking_enabled)} className="h-5 w-5 accent-palm" />
        تفعيل صفحة الحجز المباشر
      </label>
      <div>
        <label className="label" htmlFor="slug">رابط الصفحة</label>
        <div className="flex items-stretch" dir="ltr">
          <span className="flex items-center rounded-s-md border border-e-0 border-line bg-paper px-3 text-sm text-muted">{url}/book/</span>
          <input id="slug" name="slug" className="field rounded-s-none" defaultValue={v.slug ?? account.slug} required />
        </div>
        <p className="hint">حروف إنجليزية صغيرة وأرقام وشرطة، مثل rawda-studios</p>
      </div>
      <div>
        <label className="label" htmlFor="intro">نبذة تظهر أعلى الصفحة</label>
        <textarea id="intro" name="booking_intro" rows={3} className="field" defaultValue={v.booking_intro ?? account.booking_intro ?? ''} placeholder="استوديوهات مفروشة بالكامل قرب…" />
      </div>
      <Alert state={state} />
      <Submit busy={busy}>حفظ</Submit>
    </form>
  );
}

/* ---------- Public forms ---------- */

export function RequestForm({ slug, unit, checkIn, checkOut, guests }) {
  const { state, onSubmit, busy, v } = useForm(createRequest, { reset: false });
  return (
    <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="unit_id" value={unit} />
      <input type="hidden" name="check_in" value={checkIn} />
      <input type="hidden" name="check_out" value={checkOut} />
      <input type="hidden" name="guests" value={guests} />
      <div className="hidden" aria-hidden>
        <label htmlFor={`web${unit}`}>Website</label>
        <input id={`web${unit}`} name="website" tabIndex={-1} autoComplete="off" />
      </div>
      <div>
        <label className="label" htmlFor={`rn${unit}`}>الاسم</label>
        <input id={`rn${unit}`} name="name" className="field" defaultValue={v.name} autoComplete="name" required />
      </div>
      <div>
        <label className="label" htmlFor={`rp${unit}`}>الجوال</label>
        <input id={`rp${unit}`} name="phone" type="tel" dir="ltr" className="field text-start" defaultValue={v.phone} placeholder="05xxxxxxxx" autoComplete="tel" required />
      </div>
      <div className="sm:col-span-2">
        <label className="label" htmlFor={`rnote${unit}`}>ملاحظات (اختياري)</label>
        <input id={`rnote${unit}`} name="note" className="field" defaultValue={v.note} placeholder="وقت الوصول، طلبات خاصة…" />
      </div>
      <div className="sm:col-span-2">
        <Alert state={state} />
        <div className="mt-2"><Submit busy={busy} pending="جارٍ الإرسال…">إرسال طلب الحجز</Submit></div>
        <p className="hint mt-2">الطلب لا يُعتبر حجزاً حتى يؤكده المضيف. ستصلك صفحة تتابع منها حالة طلبك.</p>
      </div>
    </form>
  );
}

export function RegisterForm({ token, booking }) {
  const { state, onSubmit, busy, v } = useForm(registerGuest, { reset: false });
  const f = (k, d = '') => v[k] ?? d;
  if (state?.ok) return <p role="status" className="rounded-md bg-palm-soft px-4 py-3 text-palm-dark">{state.message}</p>;
  return (
    <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="token" value={token} />
      <div className="sm:col-span-2">
        <label className="label" htmlFor="full_name">الاسم الكامل كما في الهوية</label>
        <input id="full_name" name="full_name" className="field" defaultValue={f('full_name', booking.guest_name || '')} required />
      </div>
      <div>
        <label className="label" htmlFor="id_type">نوع الهوية</label>
        <select id="id_type" name="id_type" className="field" defaultValue={f('id_type', booking.id_type || 'national')}>
          {Object.entries(ID_TYPES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="id_number">رقم الهوية</label>
        <input id="id_number" name="id_number" dir="ltr" inputMode="numeric" className="field text-start" defaultValue={f('id_number')} required />
      </div>
      <div>
        <label className="label" htmlFor="nationality">الجنسية</label>
        <input id="nationality" name="nationality" className="field" defaultValue={f('nationality', booking.nationality || '')} />
      </div>
      <div>
        <label className="label" htmlFor="birth_date">تاريخ الميلاد</label>
        <input id="birth_date" name="birth_date" type="date" className="field" defaultValue={f('birth_date', booking.birth_date || '')} />
      </div>
      <div>
        <label className="label" htmlFor="gcount">عدد الضيوف</label>
        <input id="gcount" name="guests" type="number" min="1" className="field" defaultValue={f('guests', booking.guests)} />
      </div>
      <div>
        <label className="label" htmlFor="arrival_time">وقت الوصول المتوقع</label>
        <input id="arrival_time" name="arrival_time" type="time" className="field" defaultValue={f('arrival_time', booking.arrival_time || '')} />
      </div>
      <div className="sm:col-span-2">
        <label className="label" htmlFor="companions">أسماء المرافقين (اختياري)</label>
        <textarea id="companions" name="companions" rows={2} className="field" defaultValue={f('companions', booking.companions || '')} />
      </div>
      <div className="sm:col-span-2">
        <Alert state={state} />
        <div className="mt-2"><Submit busy={busy}>إرسال البيانات</Submit></div>
        <p className="hint mt-2">بياناتك تُستخدم لتسجيل النزلاء حسب الأنظمة، ولا تظهر لغير المضيف.</p>
      </div>
    </form>
  );
}

export function ReviewForm({ token }) {
  const { state, onSubmit, busy } = useForm(submitReview, { reset: false });
  const [rating, setRating] = useState(0);
  if (state?.ok) return <p role="status" className="rounded-md bg-palm-soft px-4 py-3 text-palm-dark">{state.message}</p>;
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <fieldset>
        <legend className="label">تقييمك العام</legend>
        <div className="flex gap-1" dir="ltr">
          {[1, 2, 3, 4, 5].map((n) => (
            <label key={n} className="cursor-pointer">
              <input type="radio" name="rating" value={n} className="peer sr-only" onChange={() => setRating(n)} required />
              <span className={`block text-3xl leading-none ${n <= rating ? 'text-saffron' : 'text-line'} peer-focus-visible:ring-2 peer-focus-visible:ring-saffron`} aria-label={`${n} من 5`}>★</span>
            </label>
          ))}
        </div>
      </fieldset>
      <div>
        <label className="label" htmlFor="cleanliness">النظافة</label>
        <select id="cleanliness" name="cleanliness" className="field w-40" defaultValue="">
          <option value="">اختر</option>
          {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} من 5</option>)}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="comment">ملاحظاتك</label>
        <textarea id="comment" name="comment" rows={3} className="field" />
      </div>
      <Alert state={state} />
      <Submit busy={busy}>إرسال التقييم</Submit>
    </form>
  );
}
