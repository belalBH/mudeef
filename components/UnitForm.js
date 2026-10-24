'use client';

import { saveUnit } from '@/lib/actions';
import { UNIT_TYPES } from '@/lib/constants';
import { Alert, Submit, useFormAction } from './ui';

export default function UnitForm({ unit }) {
  const [state, onSubmit, busy] = useFormAction(saveUnit);
  const u = state?.values ? { ...unit, ...state.values, active: !!state.values.active } : unit || {};
  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {u.id && <input type="hidden" name="id" value={u.id} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label" htmlFor="name">اسم الوحدة</label>
          <input id="name" name="name" className="field" defaultValue={u.name} placeholder="مثال: استوديو 3 - الدور الثاني" required />
        </div>
        <div>
          <label className="label" htmlFor="type">النوع</label>
          <select key={u.type || "studio"} id="type" name="type" className="field" defaultValue={u.type || "studio"}>
            {Object.entries(UNIT_TYPES).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="city">المدينة أو الحي</label>
          <input id="city" name="city" className="field" defaultValue={u.city || ''} />
        </div>
        <div>
          <label className="label" htmlFor="capacity">أقصى عدد ضيوف</label>
          <input id="capacity" name="capacity" type="number" min="1" className="field" defaultValue={u.capacity || 2} />
        </div>
        <div />
        <div>
          <label className="label" htmlFor="base_price">سعر الليلة (ر.س)</label>
          <input id="base_price" name="base_price" type="number" min="0" step="1" className="field" defaultValue={u.base_price || ''} />
        </div>
        <div>
          <label className="label" htmlFor="weekend_price">سعر ليلة الخميس والجمعة</label>
          <input id="weekend_price" name="weekend_price" type="number" min="0" step="1" className="field" defaultValue={u.weekend_price ?? ''} />
          <p className="hint">اتركه فارغاً إذا كان نفس السعر.</p>
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="notes">ملاحظات داخلية</label>
          <textarea id="notes" name="notes" rows={3} className="field" defaultValue={u.notes || ''} placeholder="رمز القفل، مكان المفتاح، تعليمات التنظيف…" />
        </div>
        {u.id && (
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" name="active" defaultChecked={!!u.active} className="h-4 w-4 accent-palm" />
            الوحدة نشطة وتدخل في التقويم والتقارير
          </label>
        )}
      </div>
      <Alert state={state} />
      <Submit busy={busy}>{u.id ? 'حفظ التعديلات' : 'إضافة الوحدة'}</Submit>
    </form>
  );
}
