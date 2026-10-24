'use client';

import { useMemo, useState } from 'react';
import { saveBooking } from '@/lib/actions';
import { PAYMENT_METHODS, SOURCES } from '@/lib/constants';
import { nightsLabel } from '@/lib/dates';
import { quote } from '@/lib/pricing';
import { Alert, Submit, useFormAction } from './ui';

function nightsBetween(a, b) {
  if (!a || !b) return 0;
  return Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
}

export default function BookingForm({ booking, units, rates = [], guests = [], defaults = {} }) {
  const [state, onSubmit, busy] = useFormAction(saveBooking);
  const b = booking || {};
  const v = state?.values || {};
  const block = (b.source || defaults.source) === 'block';
  const [unitId, setUnitId] = useState(String(b.unit_id || defaults.unit || units[0]?.id || ''));
  const [checkIn, setCheckIn] = useState(b.check_in || defaults.check_in || '');
  const [checkOut, setCheckOut] = useState(b.check_out || defaults.check_out || '');
  const [total, setTotal] = useState(b.total_amount ? String(b.total_amount) : '');
  const [source, setSource] = useState(b.source || 'direct');
  const [guestName, setGuestName] = useState(b.guest_name || '');
  const [guestPhone, setGuestPhone] = useState(b.guest_phone || '');
  const unit = units.find((u) => String(u.id) === unitId);
  const nights = nightsBetween(checkIn, checkOut);
  const q = useMemo(() => quote(unit, checkIn, checkOut, rates), [unit, checkIn, checkOut, rates]);
  const known = guests.find((g) => g.name === guestName);

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {b.id && <input type="hidden" name="id" value={b.id} />}
      {block && <input type="hidden" name="source" value="block" />}

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-3 font-semibold">{block ? 'فترة الإغلاق' : 'الإقامة'}</legend>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="unit_id">الوحدة</label>
          <select id="unit_id" name="unit_id" className="field" value={unitId} onChange={(e) => setUnitId(e.target.value)} required>
            {units.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="check_in">{block ? 'من تاريخ' : 'تاريخ الدخول'}</label>
          <input id="check_in" name="check_in" type="date" className="field" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} required />
        </div>
        <div>
          <label className="label" htmlFor="check_out">{block ? 'إلى تاريخ (يوم الفتح)' : 'تاريخ الخروج'}</label>
          <input id="check_out" name="check_out" type="date" className="field" min={checkIn || undefined} value={checkOut} onChange={(e) => setCheckOut(e.target.value)} required />
          <p className="hint">
            {nights > 0 ? nightsLabel(nights) : 'اختر تاريخاً بعد تاريخ البداية'}
            {!block && q.minNights > nights && nights > 0 && (
              <span className="block text-saffron">موسم {q.seasons.join('، ')} يشترط {q.minNights} ليالٍ على الأقل.</span>
            )}
          </p>
        </div>
        {!block && (
          <div>
            <label className="label" htmlFor="source">مصدر الحجز</label>
            <select id="source" name="source" className="field" value={source} onChange={(e) => setSource(e.target.value)}>
              {Object.entries(SOURCES).map(([k, s]) => (
                <option key={k} value={k}>{s.label}</option>
              ))}
            </select>
          </div>
        )}
      </fieldset>

      {!block && (
        <>
          <fieldset className="grid gap-4 border-t border-line pt-5 sm:grid-cols-2">
            <legend className="sr-only">الضيف</legend>
            <h3 className="font-semibold sm:col-span-2">الضيف</h3>
            <div>
              <label className="label" htmlFor="guest_name">الاسم</label>
              <input
                id="guest_name"
                name="guest_name"
                className="field"
                list="guest-list"
                autoComplete="off"
                value={guestName}
                onChange={(e) => {
                  setGuestName(e.target.value);
                  const g = guests.find((x) => x.name === e.target.value);
                  if (g?.phone) setGuestPhone(g.phone);
                }}
              />
              <datalist id="guest-list">
                {guests.map((g) => (
                  <option key={g.id} value={g.name}>{g.phone || ''}</option>
                ))}
              </datalist>
              {known && <p className="hint text-palm">ضيف سابق{known.stays ? `، ${known.stays} إقامات` : ''}{known.blacklisted ? '، في قائمة الحظر' : ''}</p>}
            </div>
            <div>
              <label className="label" htmlFor="guest_phone">الجوال</label>
              <input id="guest_phone" name="guest_phone" type="tel" dir="ltr" className="field text-start" placeholder="05xxxxxxxx" value={guestPhone} onChange={(e) => setGuestPhone(e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="guests">عدد الضيوف</label>
              <input id="guests" name="guests" type="number" min="1" className="field" defaultValue={v.guests || b.guests || 1} />
              {unit && <p className="hint">الوحدة تتسع لـ {unit.capacity}</p>}
            </div>
          </fieldset>

          <fieldset className="grid gap-4 border-t border-line pt-5 sm:grid-cols-2">
            <legend className="sr-only">المبالغ</legend>
            <h3 className="font-semibold sm:col-span-2">المبالغ</h3>
            <div>
              <label className="label" htmlFor="total_amount">إجمالي الحجز (ر.س)</label>
              <input id="total_amount" name="total_amount" type="number" min="0" step="0.01" className="field" value={total} onChange={(e) => setTotal(e.target.value)} />
              {q.total > 0 && String(q.total) !== total && (
                <button type="button" className="hint text-start text-palm underline underline-offset-2" onClick={() => setTotal(String(q.total))}>
                  استخدم السعر المحسوب: {q.total.toLocaleString('en-US')} ر.س
                  {q.seasons.length > 0 && ` (يشمل ${q.seasons.join('، ')})`}
                </button>
              )}
            </div>
            <div>
              <label className="label" htmlFor="commission">عمولة المنصة (ر.س)</label>
              <input
                id="commission"
                name="commission"
                type="number"
                min="0"
                step="0.01"
                className="field"
                defaultValue={v.commission ?? (b.id ? b.commission : '')}
                placeholder={source === 'direct' ? 'لا توجد عمولة' : 'تُحسب من نسبة المنصة'}
              />
            </div>
            {!b.id && (
              <>
                <div>
                  <label className="label" htmlFor="deposit">مدفوع الآن (عربون)</label>
                  <input id="deposit" name="deposit" type="number" min="0" step="0.01" className="field" defaultValue={v.deposit || ''} />
                </div>
                <div>
                  <label className="label" htmlFor="deposit_method">طريقة الدفع</label>
                  <select id="deposit_method" name="deposit_method" className="field" defaultValue={v.deposit_method || (source === 'direct' ? 'cash' : 'platform')} key={source}>
                    {Object.entries(PAYMENT_METHODS).map(([k, l]) => (
                      <option key={k} value={k}>{l}</option>
                    ))}
                  </select>
                </div>
              </>
            )}
          </fieldset>
        </>
      )}

      <div className="border-t border-line pt-5">
        <label className="label" htmlFor="notes">{block ? 'السبب' : 'ملاحظات'}</label>
        <textarea id="notes" name="notes" rows={3} className="field" defaultValue={v.notes ?? b.notes ?? ''} placeholder={block ? 'صيانة، استخدام شخصي، تجديد…' : ''} />
      </div>

      <Alert state={state} />
      {state?.clash && (
        <label className="flex items-center gap-2 text-sm text-danger">
          <input type="checkbox" name="force" className="h-4 w-4 accent-danger" />
          حفظ رغم التعارض (سيظهر الحجزان كتعارض حتى تحله)
        </label>
      )}
      {state?.blacklisted && (
        <label className="flex items-center gap-2 text-sm text-danger">
          <input type="checkbox" name="force_guest" className="h-4 w-4 accent-danger" />
          تجاهل الحظر وسجّل الحجز
        </label>
      )}
      <Submit busy={busy}>{block ? (b.id ? 'حفظ الإغلاق' : 'إغلاق التواريخ') : b.id ? 'حفظ التعديلات' : 'تسجيل الحجز'}</Submit>
    </form>
  );
}
