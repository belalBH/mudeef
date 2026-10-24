'use client';

import { useRef, useEffect } from 'react';
import { addPayment } from '@/lib/actions';
import { PAYMENT_METHODS } from '@/lib/constants';
import { Alert, Submit, useFormAction } from './ui';

export default function PaymentForm({ bookingId, due, today, defaultMethod = 'cash' }) {
  const [state, onSubmit, busy] = useFormAction(addPayment);
  const ref = useRef(null);
  useEffect(() => {
    if (state?.ok) ref.current?.reset();
  }, [state]);
  return (
    <form ref={ref} onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="booking_id" value={bookingId} />
      <div>
        <label className="label" htmlFor="amount">المبلغ</label>
        <input id="amount" name="amount" type="number" min="0" step="0.01" className="field" defaultValue={due > 0 ? due : ''} required />
      </div>
      <div>
        <label className="label" htmlFor="method">الطريقة</label>
        <select id="method" name="method" className="field" defaultValue={defaultMethod}>
          {Object.entries(PAYMENT_METHODS).map(([k, l]) => (
            <option key={k} value={k}>{l}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="paid_on">التاريخ</label>
        <input id="paid_on" name="paid_on" type="date" className="field" defaultValue={today} />
      </div>
      <div>
        <label className="label" htmlFor="pnote">ملاحظة</label>
        <input id="pnote" name="note" className="field" placeholder="رقم الحوالة مثلاً" />
      </div>
      <label className="flex items-center gap-2 text-sm sm:col-span-2">
        <input type="checkbox" name="refund" className="h-4 w-4 accent-danger" />
        هذا استرجاع للضيف (يُخصم من المدفوع)
      </label>
      <div className="sm:col-span-2">
        <Alert state={state} />
        <div className="mt-2">
          <Submit busy={busy}>تسجيل الدفعة</Submit>
        </div>
      </div>
    </form>
  );
}
