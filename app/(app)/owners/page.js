import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { listOwners, ownerStatement } from '@/lib/queries-v3';
import { addMonths, monthName, todayISO } from '@/lib/dates';
import { money } from '@/lib/constants';
import PageHead from '@/components/PageHead';
import { OwnerForm } from '@/components/forms-v3';

export const metadata = { title: 'الملاك وكشوف الحساب | مُضيف' };

export default async function OwnersPage() {
  const user = await requireUser();
  const owners = listOwners(user.account_id);
  const last = addMonths(todayISO().slice(0, 7), -1);
  const rows = owners.map((o) => ({ o, st: ownerStatement(user.account_id, o.id, last) }));

  return (
    <div className="max-w-5xl">
      <PageHead
        title="الملاك وكشوف الحساب"
        sub="إذا كنت تدير وحدات لملاك آخرين: حدد نسبة الإدارة، وطلّع كشف شهري لكل مالك بالإيرادات والمصاريف ومستحقاته."
      />

      {owners.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-3">مستحقات {monthName(last)}</h2>
          <div className="panel overflow-x-auto">
            <table className="table min-w-[680px]">
              <thead>
                <tr><th>المالك</th><th>الوحدات</th><th>صافي الإيراد</th><th>رسوم الإدارة</th><th>المصاريف</th><th>المستحق له</th><th>الحالة</th></tr>
              </thead>
              <tbody>
                {rows.map(({ o, st }) => (
                  <tr key={o.id}>
                    <td><Link href={`/owners/${o.id}`} className="font-semibold hover:text-palm">{o.name}</Link></td>
                    <td>{o.unit_count}</td>
                    <td>{money(st.net)}</td>
                    <td>{money(st.fee)} <span className="text-xs text-muted">({o.fee_pct}%)</span></td>
                    <td className="text-danger">{money(st.expTotal)}</td>
                    <td className="font-semibold">{money(st.payable)}</td>
                    <td>
                      {st.payout ? <span className="text-palm">حُوّل</span> : st.payable > 0 ? <Link href={`/owners/${o.id}?m=${last}`} className="text-saffron hover:underline">لم يُحوَّل</Link> : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-3">مالك جديد</h2>
        <div className="panel p-5"><OwnerForm /></div>
        <p className="mt-3 text-sm text-muted">بعد إضافة المالك، اختره في صفحة كل وحدة يملكها.</p>
      </section>
    </div>
  );
}
