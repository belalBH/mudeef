'use client';

import { useMemo, useState } from 'react';
import { saveBooking } from '@/lib/actions';
import { SOURCES } from '@/lib/constants';
import { nightsLabel } from '@/lib/dates';
import { Alert, Submit, useFormAction } from './ui';

function nightsBetween(a, b) {
  if (!a || !b) return 0;
  return Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
}

function suggestPrice(unit, a, b) {
  if (!unit || !a || !b) return 0;
  let total = 0;
  const d = new Date(a + 'T00:00:00Z');
  const end = new Date(b + 'T00:00:00Z');
  while (d < end) {
    const wd = d.getUTCDay();
    total += (wd === 4 || wd === 5) && unit.weekend_price ? unit.weekend_price : unit.base_price;
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return total;
}

export default function BookingForm({ booking, units, defaults = {} }) {
  const [state, onSubmit, busy] = useFormAction(saveBooking);
  const b = booking || {};
  const v = state?.values || {};
  const [unitId, setUnitId] = useState(String(b.unit_id || defaults.unit || units[0]?.id || ''));
  const [checkIn, setCheckIn] = useState(b.check_in || defaults.check_in || '');
  const [checkOut, setCheckOut] = useState(b.check_out || defaults.check_out || '');
  const [total, setTotal] = useState(b.total_amount ? String(b.total_amount) : '');
  const [source, setSource] = useState(b.source || 'direct');
  const [status, setStatus] = useState(b.status || 'confirmed');
  const unit = units.find((u) => String(u.id) === unitId);
  const nights = nightsBetween(checkIn, checkOut);
  const suggested = useMemo(() => suggestPrice(unit, checkIn, checkOut), [unit, checkIn, checkOut]);

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {b.id && <input type="hidden" name="id" value={b.id} />}

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-3 font-semibold">الإقامة</legend>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="unit_id">الوحدة</label>
          <select id="unit_id" name="unit_id" className="field" value={unitId} onChange={(e) => setUnitId(e.target.value)} required>
            {units.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="check_in">تاريخ الدخول</label>
          <input id="check_in" name="check_in" type="date" className="field" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} required />
        </div>
        <div>
          <label className="label" htmlFor="check_out">تاريخ الخروج</label>
          <input id="check_out" name="check_out" type="date" className="field" min={checkIn || undefined} value={checkOut} onChange={(e) => setCheckOut(e.target.value)} required />
          <p className="hint">{nights > 0 ? nightsLabel(nights) : 'اختر تاريخ خروج بعد تاريخ الدخول'}</p>
        </div>
        <div>
          <label className="label" htmlFor="source">مصدر الحجز</label>
          <select id="source" name="source" className="field" value={source} onChange={(e) => setSource(e.target.value)}>
            {Object.entries(SOURCES).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="status">الحالة</label>
          <select id="status" name="status" className="field" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="confirmed">مؤكد</option>
            <option value="cancelled">ملغي</option>
          </select>
        </div>
      </fieldset>

      <fieldset className="grid gap-4 border-t border-line pt-5 sm:grid-cols-2">
        <legend className="sr-only">الضيف</legend>
        <h3 className="font-semibold sm:col-span-2">الضيف</h3>
        <div>
          <label className="label" htmlFor="guest_name">الاسم</label>
          <input id="guest_name" name="guest_name" className="field" defaultValue={v.guest_name ?? b.guest_name ?? ''} />
        </div>
        <div>
          <label className="label" htmlFor="guest_phone">الجوال</label>
          <input id="guest_phone" name="guest_phone" type="tel" dir="ltr" className="field text-start" placeholder="05xxxxxxxx" defaultValue={v.guest_phone ?? b.guest_phone ?? ''} />
        </div>
        <div>
          <label className="label" htmlFor="guests">عدد الضيوف</label>
          <input id="guests" name="guests" type="number" min="1" className="field" defaultValue={v.guests || b.guests || 1} />
        </div>
      </fieldset>

      <fieldset className="grid gap-4 border-t border-line pt-5 sm:grid-cols-3">
        <legend className="sr-only">المبالغ</legend>
        <h3 className="font-semibold sm:col-span-3">المبالغ</h3>
        <div>
          <label className="label" htmlFor="total_amount">إجمالي الحجز (ر.س)</label>
          <input id="total_amount" name="total_amount" type="number" min="0" step="0.01" className="field" value={total} onChange={(e) => setTotal(e.target.value)} />
          {suggested > 0 && String(suggested) !== total && (
            <button type="button" className="hint text-palm underline underline-offset-2" onClick={() => setTotal(String(suggested))}>
              استخدم سعر الوحدة: {suggested.toLocaleString('en-US')} ر.س
            </button>
          )}
        </div>
        <div>
          <label className="label" htmlFor="commission">عمولة المنصة</label>
          <input id="commission" name="commission" type="number" min="0" step="0.01" className="field" defaultValue={v.commission ?? (b.id ? b.commission : '')} placeholder="تُحسب تلقائياً" />
        </div>
        <div>
          <label className="label" htmlFor="paid_amount">المدفوع</label>
          <input id="paid_amount" name="paid_amount" type="number" min="0" step="0.01" className="field" defaultValue={v.paid_amount ?? (b.paid_amount || '')} />
        </div>
        <div className="sm:col-span-3">
          <label className="label" htmlFor="notes">ملاحظات</label>
          <textarea id="notes" name="notes" rows={3} className="field" defaultValue={v.notes ?? b.notes ?? ''} />
        </div>
      </fieldset>

      <Alert state={state} />
      {state?.clash && (
        <label className="flex items-center gap-2 text-sm text-danger">
          <input type="checkbox" name="force" className="h-4 w-4 accent-danger" />
          حفظ رغم التعارض (سيظهر الحجزان كتعارض حتى تحله)
        </label>
      )}
      <Submit busy={busy}>{b.id ? 'حفظ التعديلات' : 'تسجيل الحجز'}</Submit>
    </form>
  );
}
