import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { getUnit, listSeasons, unitBlocks, unitChannels } from '@/lib/queries';
import { prettyDate } from '@/lib/dates';
import { money } from '@/lib/constants';
import { deleteBooking, deleteUnit } from '@/lib/actions';
import { baseUrl } from '@/lib/baseurl';
import { CHANNEL_SOURCES } from '@/lib/constants';
import UnitForm from '@/components/UnitForm';
import ChannelCard from '@/components/ChannelCard';
import { ConfirmButton, CopyField } from '@/components/ui';

export default async function UnitPage({ params, searchParams }) {
  const user = await requireUser();
  const { id } = await params;
  const sp = await searchParams;
  const unit = getUnit(user.account_id, Number(id));
  if (!unit) notFound();
  const channels = unitChannels(user.account_id, unit.id);
  const base = await baseUrl();
  const blocks = unitBlocks(user.account_id, unit.id);
  const seasons = listSeasons(user.account_id).filter((s) => s.unit_id === unit.id || s.unit_id == null);

  return (
    <div className="max-w-5xl">
      <Link href="/units" className="text-sm text-muted hover:text-palm">الوحدات</Link>
      <div className="mb-6 mt-1 flex flex-wrap items-end justify-between gap-3">
        <h1>{unit.name}</h1>
        <div className="flex flex-wrap gap-2">
          <Link href={`/bookings?unit=${unit.id}&view=all`} className="btn-ghost">حجوزات الوحدة</Link>
          <Link href={`/bookings/new?unit=${unit.id}&block=1`} className="btn-ghost">إغلاق تواريخ</Link>
          <Link href={`/bookings/new?unit=${unit.id}`} className="btn-primary">حجز مباشر</Link>
        </div>
      </div>

      {sp.saved && <p className="mb-6 rounded-md bg-palm-soft px-4 py-3 text-sm text-palm-dark">تم حفظ التعديلات.</p>}
      {sp.blocked && <p className="mb-6 rounded-md bg-palm-soft px-4 py-3 text-sm text-palm-dark">تم إغلاق التواريخ، وستظهر محجوزة في المنصات المربوطة.</p>}
      {sp.created && (
        <p className="mb-6 rounded-md bg-palm-soft px-4 py-3 text-sm text-palm-dark">
          تمت إضافة الوحدة. الخطوة التالية: اربطها بالمنصات من الأسفل حتى تصل حجوزاتها تلقائياً.
        </p>
      )}

      <div className="grid gap-8 xl:grid-cols-[1fr_1.15fr]">
        <section>
          <h2 className="mb-3">بيانات الوحدة</h2>
          <div className="panel p-5">
            <UnitForm unit={unit} />
          </div>
          <div className="panel mt-4 p-5">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="font-semibold">التواريخ المغلقة</h3>
              <Link href={`/bookings/new?unit=${unit.id}&block=1`} className="text-sm text-palm hover:underline">إغلاق جديد</Link>
            </div>
            {blocks.length === 0 ? (
              <p className="text-sm text-muted">لا توجد تواريخ مغلقة قادمة.</p>
            ) : (
              <ul className="divide-y divide-line text-sm">
                {blocks.map((b) => (
                  <li key={b.id} className="flex items-center justify-between gap-2 py-2">
                    <Link href={`/bookings/${b.id}`} className="hover:text-palm">
                      {prettyDate(b.check_in)} إلى {prettyDate(b.check_out)}
                      {b.notes && <span className="text-muted">، {b.notes}</span>}
                    </Link>
                    <form action={deleteBooking}>
                      <input type="hidden" name="id" value={b.id} />
                      <button className="text-xs text-danger hover:underline">فتح</button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="panel mt-4 p-5">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="font-semibold">أسعار المواسم</h3>
              <Link href="/pricing" className="text-sm text-palm hover:underline">إدارة المواسم</Link>
            </div>
            {seasons.length === 0 ? (
              <p className="text-sm text-muted">تستخدم الوحدة سعرها الأساسي طوال السنة.</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {seasons.map((s) => (
                  <li key={s.id} className="flex justify-between gap-2">
                    <span>{s.name} <span className="text-muted">({prettyDate(s.start_on)} إلى {prettyDate(s.end_on)}){s.unit_id == null ? '، لكل الوحدات' : ''}</span></span>
                    <span>{money(s.price)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="panel mt-4 p-5">
            <CopyField label="رابط التقويم الكامل للوحدة" value={`${base}/api/ical/${unit.export_token}.ics`} />
            <p className="hint">يحتوي كل الحجوزات. استخدمه لتقويم جوالك أو لأي منصة جديدة غير مربوطة.</p>
          </div>
          <form action={deleteUnit} className="mt-4">
            <input type="hidden" name="id" value={unit.id} />
            <ConfirmButton message="حذف الوحدة نهائياً مع كل حجوزاتها وروابطها؟">حذف الوحدة</ConfirmButton>
          </form>
        </section>

        <section>
          <h2>الربط مع المنصات</h2>
          <p className="mb-3 mt-1 text-sm text-muted">
            لكل منصة رابطان: تأخذ رابطها وتلصقه هنا، وتأخذ رابط مُضيف وتلصقه عندها. بعدها أي حجز في منصة يُغلق تلقائياً في البقية.
          </p>
          <div className="space-y-4">
            {CHANNEL_SOURCES.map((src) => {
              const ch = channels.find((c) => c.source === src);
              return (
                <ChannelCard
                  key={src}
                  unitId={unit.id}
                  source={src}
                  channel={ch}
                  exportUrl={ch ? `${base}/api/ical/${ch.export_token}.ics` : ''}
                />
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
