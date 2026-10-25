'use client';

import { saveUnit } from '@/lib/actions';
import { UNIT_TYPES } from '@/lib/constants';
import { Alert, Submit, useFormAction } from './ui';

export default function UnitForm({ unit, owners = [] }) {
  const [state, onSubmit, busy] = useFormAction(saveUnit);
  const u = state?.values ? { ...unit, ...state.values, active: !!state.values.active, public: state.values.public ? 1 : 0 } : unit || {};
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
        <div>
          <label className="label" htmlFor="bedrooms">غرف النوم</label>
          <input id="bedrooms" name="bedrooms" type="number" min="0" className="field" defaultValue={u.bedrooms ?? ''} />
        </div>
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
          <label className="label" htmlFor="checkin_info">تعليمات الدخول للضيف</label>
          <textarea id="checkin_info" name="checkin_info" rows={3} className="field" defaultValue={u.checkin_info || ''} placeholder="الموقع، رقم الدور، رمز القفل، شبكة الواي فاي…" />
          <p className="hint">تظهر للضيف في صفحته الخاصة وفي رسالة واتساب "تعليمات الدخول".</p>
        </div>
        <div>
          <label className="label" htmlFor="wifi_name">اسم شبكة الواي فاي</label>
          <input id="wifi_name" name="wifi_name" dir="auto" className="field" defaultValue={u.wifi_name || ''} />
        </div>
        <div>
          <label className="label" htmlFor="wifi_password">كلمة مرور الواي فاي</label>
          <input id="wifi_password" name="wifi_password" dir="ltr" className="field text-start" defaultValue={u.wifi_password || ''} />
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="map_url">رابط الموقع على الخريطة</label>
          <input id="map_url" name="map_url" dir="ltr" className="field text-start" defaultValue={u.map_url || ''} placeholder="https://maps.app.goo.gl/…" />
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="description">وصف الوحدة</label>
          <textarea id="description" name="description" rows={3} className="field" defaultValue={u.description || ''} placeholder="يظهر في صفحة الحجز المباشر" />
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="amenities">المرافق</label>
          <input id="amenities" name="amenities" className="field" defaultValue={u.amenities || ''} placeholder="واي فاي، مطبخ، غسالة، موقف سيارة، دخول ذاتي" />
          <p className="hint">افصل بينها بفاصلة.</p>
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="house_rules">قوانين السكن</label>
          <textarea id="house_rules" name="house_rules" rows={2} className="field" defaultValue={u.house_rules || ''} placeholder="ممنوع التدخين، الهدوء بعد 11 مساءً…" />
        </div>
        {owners.length > 0 && (
          <div>
            <label className="label" htmlFor="owner_id">المالك</label>
            <select id="owner_id" name="owner_id" className="field" defaultValue={u.owner_id ?? ''}>
              <option value="">ملك النشاط</option>
              {owners.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </div>
        )}
        <div className="sm:col-span-2">
          <label className="label" htmlFor="notes">ملاحظات داخلية</label>
          <textarea id="notes" name="notes" rows={3} className="field" defaultValue={u.notes || ''} placeholder="ملاحظات لك وللفريق فقط" />
        </div>
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input type="checkbox" name="public" defaultChecked={u.public === undefined ? true : !!Number(u.public)} className="h-4 w-4 accent-palm" />
          تظهر في صفحة الحجز المباشر
        </label>
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
