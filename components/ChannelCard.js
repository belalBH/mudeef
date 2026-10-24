'use client';

import { saveChannel, deleteChannel, syncNow } from '@/lib/actions';
import { SOURCES } from '@/lib/constants';
import { Alert, ConfirmButton, CopyField, Submit, useFormAction } from './ui';

const HOW_TO = {
  airbnb: {
    import: 'في Airbnb افتح تقويم الإعلان وابحث عن "مزامنة التقويمات" ثم "تصدير التقويم"، وانسخ الرابط.',
    export: 'في نفس الصفحة اختر "استيراد التقويم" والصق رابط مُضيف.',
    rate: 3,
  },
  booking: {
    import: 'في لوحة Booking.com (Extranet) افتح قسم الأسعار والتوافر وابحث عن "مزامنة التقويمات" ثم التصدير، وانسخ الرابط.',
    export: 'في نفس الصفحة اختر "استيراد تقويم" والصق رابط مُضيف.',
    rate: 15,
  },
  gathern: {
    import: 'إذا كانت لوحة جاذر إن توفر رابط iCal للتقويم انسخه هنا. إن لم يتوفر، اطلب من دعم جاذر إن ربط التقويم.',
    export: 'أعطِ رابط مُضيف لجاذر إن ليغلقوا التواريخ المحجوزة من المنصات الأخرى.',
    rate: 10,
  },
  other: {
    import: 'أي منصة توفر رابط تقويم iCal (ينتهي غالباً بـ .ics).',
    export: 'الصق رابط مُضيف في خانة استيراد التقويم في تلك المنصة.',
    rate: 0,
  },
};

function fmtSync(ch) {
  if (!ch?.last_sync_at) return null;
  const d = new Date(ch.last_sync_at.replace(' ', 'T') + 'Z');
  return d.toLocaleString('ar-SA-u-ca-gregory-nu-latn', { timeZone: 'Asia/Riyadh', dateStyle: 'medium', timeStyle: 'short' });
}

export default function ChannelCard({ unitId, source, channel, exportUrl }) {
  const [state, onSubmit, busy] = useFormAction(saveChannel);
  const info = HOW_TO[source];
  const v = state?.values || {};
  const s = SOURCES[source];
  const statusColor = { ok: 'text-palm', warning: 'text-saffron', error: 'text-danger' }[channel?.last_sync_status] || 'text-muted';

  return (
    <section className="panel overflow-hidden">
      <header className="flex items-center justify-between gap-3 border-b border-line px-5 py-3" style={{ borderInlineStart: `4px solid ${s.color}` }}>
        <h3 className="font-semibold">{s.label}</h3>
        {channel ? (
          <span className={`text-xs ${statusColor}`}>
            {channel.import_url ? (channel.last_sync_status === 'error' ? 'فشلت آخر مزامنة' : 'مربوطة') : 'تصدير فقط'}
          </span>
        ) : (
          <span className="text-xs text-muted">غير مربوطة</span>
        )}
      </header>
      <div className="space-y-5 p-5">
        <form onSubmit={onSubmit} className="space-y-3">
          <input type="hidden" name="unit_id" value={unitId} />
          <input type="hidden" name="source" value={source} />
          <div>
            <label className="label" htmlFor={`imp-${source}`}>1. رابط تقويم {s.label} (استيراد)</label>
            <input
              id={`imp-${source}`}
              name="import_url"
              dir="ltr"
              className="field text-start font-mono text-xs"
              placeholder="https://…/calendar.ics"
              defaultValue={v.import_url ?? channel?.import_url ?? ''}
            />
            <p className="hint">{info.import}</p>
          </div>
          <div className="w-40">
            <label className="label" htmlFor={`rate-${source}`}>عمولة المنصة %</label>
            <input
              id={`rate-${source}`}
              name="commission_rate"
              type="number"
              min="0"
              max="100"
              step="0.1"
              className="field"
              defaultValue={v.commission_rate ?? channel?.commission_rate ?? info.rate}
            />
          </div>
          <Alert state={state} />
          <Submit busy={busy} pending="جارٍ الربط والمزامنة…">{channel ? 'حفظ ومزامنة' : 'ربط المنصة'}</Submit>
        </form>

        {channel && (
          <>
            <div className="border-t border-line pt-4">
              <CopyField label={`2. رابط مُضيف لـ ${s.label} (تصدير)`} value={exportUrl} />
              <p className="hint">{info.export} هذا الرابط يحتوي على حجوزات المنصات الأخرى والحجوزات المباشرة فقط.</p>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4 text-xs text-muted">
              <span>
                {fmtSync(channel) ? `آخر مزامنة: ${fmtSync(channel)}` : 'لم تتم المزامنة بعد'}
                {channel.last_sync_message && <span className={`block ${statusColor}`}>{channel.last_sync_message}</span>}
              </span>
              <div className="flex gap-1">
                {channel.import_url && (
                  <form action={syncNow}>
                    <input type="hidden" name="id" value={channel.id} />
                    <Submit className="btn-ghost px-3 py-1.5 text-xs" pending="جارٍ المزامنة…">مزامنة الآن</Submit>
                  </form>
                )}
                <form action={deleteChannel}>
                  <input type="hidden" name="id" value={channel.id} />
                  <ConfirmButton className="btn-danger px-3 py-1.5 text-xs" message={`فصل ${s.label} عن هذه الوحدة؟ ستُحذف الحجوزات المستوردة التي لم تُسعّر.`}>
                    فصل
                  </ConfirmButton>
                </form>
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
