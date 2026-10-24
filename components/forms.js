'use client';

// Small action forms that reset themselves after a successful save
import { useEffect, useRef } from 'react';
import { saveExpense, saveGuest, saveSeason, saveTask, saveBusiness, saveTemplates, saveProfile, changePassword } from '@/lib/actions-more';
import { EXPENSE_CATEGORIES, TASK_TYPES } from '@/lib/constants';
import { TEMPLATE_VARS } from '@/lib/templates';
import { Alert, Submit, useFormAction } from './ui';

function useResettingForm(action, { reset = true } = {}) {
  const [state, onSubmit, busy] = useFormAction(action);
  const ref = useRef(null);
  useEffect(() => {
    if (state?.ok && reset) ref.current?.reset();
  }, [state, reset]);
  return { state, onSubmit, busy, ref, v: state?.values || {} };
}

export function ExpenseForm({ units, today, expense }) {
  const e = expense || {};
  const { state, onSubmit, busy, ref, v } = useResettingForm(saveExpense);
  return (
    <form ref={ref} onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_1fr]">
      {e.id && <input type="hidden" name="id" value={e.id} />}
      <div>
        <label className="label" htmlFor="amount">المبلغ (ر.س)</label>
        <input id="amount" name="amount" type="number" min="0" step="0.01" className="field" defaultValue={v.amount ?? e.amount ?? ''} required />
      </div>
      <div>
        <label className="label" htmlFor="category">البند</label>
        <select id="category" name="category" className="field" defaultValue={v.category || e.category || 'cleaning'}>
          {Object.entries(EXPENSE_CATEGORIES).map(([k, l]) => (
            <option key={k} value={k}>{l}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="unit_id">الوحدة</label>
        <select id="unit_id" name="unit_id" className="field" defaultValue={v.unit_id ?? e.unit_id ?? ''}>
          <option value="">عام (كل الوحدات)</option>
          {units.map((u) => (
            <option key={u.id} value={u.id}>{u.name}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="spent_on">التاريخ</label>
        <input id="spent_on" name="spent_on" type="date" className="field" defaultValue={v.spent_on || e.spent_on || today} required />
      </div>
      <div className="sm:col-span-2 lg:col-span-3">
        <label className="label" htmlFor="enote">ملاحظة</label>
        <input id="enote" name="note" className="field" defaultValue={v.note ?? e.note ?? ''} placeholder="مثال: فاتورة كهرباء أكتوبر" />
      </div>
      <div className="flex items-end">
        <Submit busy={busy} className="btn-primary w-full">{e.id ? 'حفظ المصروف' : 'إضافة المصروف'}</Submit>
      </div>
      <div className="sm:col-span-2 lg:col-span-4">
        <Alert state={state} />
      </div>
    </form>
  );
}

export function TaskForm({ units, today, people = [] }) {
  const { state, onSubmit, busy, ref, v } = useResettingForm(saveTask);
  return (
    <form ref={ref} onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <div>
        <label className="label" htmlFor="ttype">النوع</label>
        <select id="ttype" name="type" className="field" defaultValue={v.type || 'maintenance'}>
          {Object.entries(TASK_TYPES).map(([k, l]) => (
            <option key={k} value={k}>{l}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="tunit">الوحدة</label>
        <select id="tunit" name="unit_id" className="field" defaultValue={v.unit_id || units[0]?.id}>
          {units.map((u) => (
            <option key={u.id} value={u.id}>{u.name}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="tdue">التاريخ</label>
        <input id="tdue" name="due_on" type="date" className="field" defaultValue={v.due_on || today} required />
      </div>
      <div>
        <label className="label" htmlFor="tassignee">المسؤول</label>
        <input id="tassignee" name="assignee" className="field" list="people" defaultValue={v.assignee || ''} placeholder="اسم العامل" />
        <datalist id="people">
          {people.map((p) => <option key={p} value={p} />)}
        </datalist>
      </div>
      <div className="sm:col-span-2 lg:col-span-1 lg:row-start-2 lg:col-start-1 lg:col-end-5">
        <label className="label" htmlFor="ttitle">الوصف</label>
        <input id="ttitle" name="title" className="field" defaultValue={v.title || ''} placeholder="مثال: تصليح المكيف" />
      </div>
      <div className="flex items-end lg:row-start-2">
        <Submit busy={busy} className="btn-primary w-full">إضافة المهمة</Submit>
      </div>
      <div className="sm:col-span-2 lg:col-span-5">
        <Alert state={state} />
      </div>
    </form>
  );
}

export function GuestForm({ guest }) {
  const g = guest || {};
  const { state, onSubmit, busy, ref, v } = useResettingForm(saveGuest, { reset: false });
  return (
    <form ref={ref} onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
      {g.id && <input type="hidden" name="id" value={g.id} />}
      <div>
        <label className="label" htmlFor="gname">الاسم</label>
        <input id="gname" name="name" className="field" defaultValue={v.name ?? g.name ?? ''} required />
      </div>
      <div>
        <label className="label" htmlFor="gphone">الجوال</label>
        <input id="gphone" name="phone" type="tel" dir="ltr" className="field text-start" defaultValue={v.phone ?? g.phone ?? ''} />
      </div>
      <div>
        <label className="label" htmlFor="gemail">البريد</label>
        <input id="gemail" name="email" type="email" dir="ltr" className="field text-start" defaultValue={v.email ?? g.email ?? ''} />
      </div>
      <div>
        <label className="label" htmlFor="gnat">الجنسية</label>
        <input id="gnat" name="nationality" className="field" defaultValue={v.nationality ?? g.nationality ?? ''} />
      </div>
      <div className="sm:col-span-2">
        <label className="label" htmlFor="gnotes">ملاحظات</label>
        <textarea id="gnotes" name="notes" rows={2} className="field" defaultValue={v.notes ?? g.notes ?? ''} placeholder="تفضيلات الضيف، أو سبب الحظر" />
      </div>
      <label className="flex items-center gap-2 text-sm text-danger sm:col-span-2">
        <input type="checkbox" name="blacklisted" defaultChecked={!!(v.blacklisted ?? g.blacklisted)} className="h-4 w-4 accent-danger" />
        قائمة الحظر: تنبيه عند أي حجز جديد لهذا الضيف
      </label>
      <div className="sm:col-span-2">
        <Alert state={state} />
        <div className="mt-2">
          <Submit busy={busy}>{g.id ? 'حفظ بيانات الضيف' : 'إضافة الضيف'}</Submit>
        </div>
      </div>
    </form>
  );
}

export function SeasonForm({ units, season }) {
  const s = season || {};
  const { state, onSubmit, busy, ref, v } = useResettingForm(saveSeason, { reset: !s.id });
  return (
    <form ref={ref} onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {s.id && <input type="hidden" name="id" value={s.id} />}
      <div className="lg:col-span-2">
        <label className="label" htmlFor={`sname${s.id || ''}`}>اسم الموسم</label>
        <input id={`sname${s.id || ''}`} name="name" className="field" defaultValue={v.name ?? s.name ?? ''} placeholder="موسم الحج، إجازة الصيف، رمضان…" required />
      </div>
      <div className="lg:col-span-2">
        <label className="label" htmlFor={`sunit${s.id || ''}`}>يطبق على</label>
        <select id={`sunit${s.id || ''}`} name="unit_id" className="field" defaultValue={v.unit_id ?? s.unit_id ?? ''}>
          <option value="">كل الوحدات</option>
          {units.map((u) => (
            <option key={u.id} value={u.id}>{u.name}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="label" htmlFor={`sstart${s.id || ''}`}>من</label>
        <input id={`sstart${s.id || ''}`} name="start_on" type="date" className="field" defaultValue={v.start_on || s.start_on || ''} required />
      </div>
      <div>
        <label className="label" htmlFor={`send${s.id || ''}`}>إلى (آخر ليلة)</label>
        <input id={`send${s.id || ''}`} name="end_on" type="date" className="field" defaultValue={v.end_on || s.end_on || ''} required />
      </div>
      <div>
        <label className="label" htmlFor={`sprice${s.id || ''}`}>سعر الليلة</label>
        <input id={`sprice${s.id || ''}`} name="price" type="number" min="0" className="field" defaultValue={v.price ?? s.price ?? ''} required />
      </div>
      <div>
        <label className="label" htmlFor={`swp${s.id || ''}`}>الخميس والجمعة</label>
        <input id={`swp${s.id || ''}`} name="weekend_price" type="number" min="0" className="field" defaultValue={v.weekend_price ?? s.weekend_price ?? ''} placeholder="نفس السعر" />
      </div>
      <div>
        <label className="label" htmlFor={`smin${s.id || ''}`}>أقل عدد ليالٍ</label>
        <input id={`smin${s.id || ''}`} name="min_nights" type="number" min="1" className="field" defaultValue={v.min_nights ?? s.min_nights ?? 1} />
      </div>
      <div className="flex items-end lg:col-span-3">
        <Submit busy={busy}>{s.id ? 'حفظ' : 'إضافة الموسم'}</Submit>
      </div>
      <div className="sm:col-span-2 lg:col-span-4">
        <Alert state={state} />
      </div>
    </form>
  );
}

export function BusinessForm({ account }) {
  const a = account;
  const { state, onSubmit, busy, ref, v } = useResettingForm(saveBusiness, { reset: false });
  const f = (k, d = '') => v[k] ?? a[k] ?? d;
  return (
    <form ref={ref} onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
      <div>
        <label className="label" htmlFor="bname">اسم النشاط</label>
        <input id="bname" name="name" className="field" defaultValue={f('name')} required />
      </div>
      <div>
        <label className="label" htmlFor="bphone">جوال النشاط</label>
        <input id="bphone" name="phone" dir="ltr" className="field text-start" defaultValue={f('phone')} />
      </div>
      <div className="sm:col-span-2">
        <label className="label" htmlFor="baddress">العنوان</label>
        <input id="baddress" name="address" className="field" defaultValue={f('address')} />
      </div>
      <div>
        <label className="label" htmlFor="bvat">الرقم الضريبي</label>
        <input id="bvat" name="vat_number" dir="ltr" inputMode="numeric" className="field text-start" defaultValue={f('vat_number')} placeholder="3xxxxxxxxxxxxx3" />
        <p className="hint">إذا أضفته تظهر الضريبة 15% في الفواتير.</p>
      </div>
      <div>
        <label className="label" htmlFor="bfee">أجرة التنظيف لكل خروج</label>
        <input id="bfee" name="cleaning_fee" type="number" min="0" className="field" defaultValue={f('cleaning_fee', 0)} />
        <p className="hint">تُسجّل تلقائياً كمصروف عند إنهاء كل مهمة تنظيف. اتركها 0 لإيقافها.</p>
      </div>
      <div>
        <label className="label" htmlFor="bin">وقت الدخول</label>
        <input id="bin" name="checkin_time" type="time" className="field" defaultValue={f('checkin_time', '15:00')} />
      </div>
      <div>
        <label className="label" htmlFor="bout">وقت الخروج</label>
        <input id="bout" name="checkout_time" type="time" className="field" defaultValue={f('checkout_time', '12:00')} />
      </div>
      <div className="sm:col-span-2">
        <label className="label" htmlFor="bnote">ملاحظة أسفل الفاتورة</label>
        <textarea id="bnote" name="invoice_note" rows={2} className="field" defaultValue={f('invoice_note')} placeholder="سياسة الإلغاء، أو شكر للضيف" />
      </div>
      <div className="sm:col-span-2">
        <Alert state={state} />
        <div className="mt-2"><Submit busy={busy}>حفظ بيانات النشاط</Submit></div>
      </div>
    </form>
  );
}

export function TemplatesForm({ templates }) {
  const { state, onSubmit, busy, ref } = useResettingForm(saveTemplates, { reset: false });
  return (
    <form ref={ref} onSubmit={onSubmit} className="space-y-4">
      {[
        ['wa_confirm', 'تأكيد الحجز', templates.confirm.text],
        ['wa_checkin', 'تعليمات الدخول', templates.checkin.text],
        ['wa_thanks', 'شكر بعد الخروج', templates.thanks.text],
      ].map(([k, l, val]) => (
        <div key={k}>
          <label className="label" htmlFor={k}>{l}</label>
          <textarea id={k} name={k} rows={4} className="field" defaultValue={val} />
        </div>
      ))}
      <p className="hint">
        الكلمات بين الأقواس تتبدل تلقائياً: {TEMPLATE_VARS.map((x) => `{${x}}`).join('  ')}
      </p>
      <Alert state={state} />
      <Submit busy={busy}>حفظ الرسائل</Submit>
    </form>
  );
}

export function ProfileForm({ user }) {
  const { state, onSubmit, busy, ref, v } = useResettingForm(saveProfile, { reset: false });
  return (
    <form ref={ref} onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
      <div>
        <label className="label" htmlFor="pname">اسمك</label>
        <input id="pname" name="name" className="field" defaultValue={v.name ?? user.name} required />
      </div>
      <div>
        <label className="label" htmlFor="pemail">البريد الإلكتروني</label>
        <input id="pemail" name="email" type="email" dir="ltr" className="field text-start" defaultValue={v.email ?? user.email} required />
      </div>
      <div className="sm:col-span-2">
        <Alert state={state} />
        <div className="mt-2"><Submit busy={busy}>حفظ</Submit></div>
      </div>
    </form>
  );
}

export function PasswordForm() {
  const { state, onSubmit, busy, ref } = useResettingForm(changePassword);
  return (
    <form ref={ref} onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-3">
      <div>
        <label className="label" htmlFor="cur">كلمة المرور الحالية</label>
        <input id="cur" name="current_password" type="password" dir="ltr" className="field" autoComplete="current-password" required />
      </div>
      <div>
        <label className="label" htmlFor="np">الجديدة</label>
        <input id="np" name="new_password" type="password" dir="ltr" className="field" autoComplete="new-password" minLength={8} required />
      </div>
      <div>
        <label className="label" htmlFor="cp">تأكيد الجديدة</label>
        <input id="cp" name="confirm_password" type="password" dir="ltr" className="field" autoComplete="new-password" minLength={8} required />
      </div>
      <div className="sm:col-span-3">
        <Alert state={state} />
        <div className="mt-2"><Submit busy={busy}>تغيير كلمة المرور</Submit></div>
      </div>
    </form>
  );
}
