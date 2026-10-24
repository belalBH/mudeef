import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { listUnits } from '@/lib/queries';
import { UNIT_TYPES, money } from '@/lib/constants';
import PageHead from '@/components/PageHead';

export const metadata = { title: 'الوحدات | مُضيف' };

export default async function UnitsPage() {
  const user = await requireUser();
  const units = listUnits(user.account_id);
  return (
    <>
      <PageHead title="الوحدات" sub="الغرف والاستوديوهات التي تديرها.">
        <Link href="/units/new" className="btn-primary">إضافة وحدة</Link>
      </PageHead>
      {units.length === 0 ? (
        <div className="panel px-6 py-12 text-center">
          <h2>أضف أول وحدة</h2>
          <p className="mx-auto mt-2 max-w-md text-muted">
            كل غرفة أو استوديو تؤجره يكون وحدة مستقلة، ولكل وحدة تقويمها وروابط ربطها مع المنصات.
          </p>
          <Link href="/units/new" className="btn-primary mt-5">إضافة وحدة</Link>
        </div>
      ) : (
        <div className="panel overflow-x-auto">
          <table className="table min-w-[640px]">
            <thead>
              <tr>
                <th>الوحدة</th>
                <th>النوع</th>
                <th>الضيوف</th>
                <th>سعر الليلة</th>
                <th>المنصات المربوطة</th>
                <th>الحالة</th>
              </tr>
            </thead>
            <tbody>
              {units.map((u) => (
                <tr key={u.id} className="hover:bg-paper/60">
                  <td>
                    <Link href={`/units/${u.id}`} className="font-semibold hover:text-palm">{u.name}</Link>
                    {u.city && <div className="text-xs text-muted">{u.city}</div>}
                  </td>
                  <td>{UNIT_TYPES[u.type]}</td>
                  <td>{u.capacity}</td>
                  <td>{money(u.base_price)}</td>
                  <td>{u.channel_count ? `${u.channel_count} منصة` : <span className="text-saffron">غير مربوطة</span>}</td>
                  <td>{u.active ? 'نشطة' : <span className="text-muted">موقوفة</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
