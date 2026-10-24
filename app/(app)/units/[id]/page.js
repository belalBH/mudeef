import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { getUnit, unitChannels } from '@/lib/queries';
import { deleteUnit } from '@/lib/actions';
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

  return (
    <div className="max-w-5xl">
      <Link href="/units" className="text-sm text-muted hover:text-palm">الوحدات</Link>
      <div className="mb-6 mt-1 flex flex-wrap items-end justify-between gap-3">
        <h1>{unit.name}</h1>
        <Link href={`/bookings/new?unit=${unit.id}`} className="btn-ghost">حجز مباشر لهذه الوحدة</Link>
      </div>

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
