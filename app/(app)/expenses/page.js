import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { listExpenses, listUnits } from '@/lib/queries';
import { deleteExpense } from '@/lib/actions-more';
import { addMonths, monthName, prettyDate, todayISO } from '@/lib/dates';
import { EXPENSE_CATEGORIES, money } from '@/lib/constants';
import PageHead from '@/components/PageHead';
import { ExpenseForm } from '@/components/forms';
import { ConfirmButton } from '@/components/ui';

export const metadata = { title: 'المصاريف | مُضيف' };

export default async function ExpensesPage({ searchParams }) {
  const user = await requireUser();
  const sp = await searchParams;
  const today = todayISO();
  const ym = /^\d{4}-\d{2}$/.test(sp.m || '') ? sp.m : today.slice(0, 7);
  const units = listUnits(user.account_id);
  const rows = listExpenses(user.account_id, ym);
  const total = rows.reduce((a, e) => a + e.amount, 0);
  const byCat = {};
  for (const e of rows) byCat[e.category] = (byCat[e.category] || 0) + e.amount;
  const cats = Object.entries(byCat).sort((a, b) => b[1] - a[1]);

  return (
    <>
      <PageHead title="المصاريف" sub="كل ما تصرفه على الوحدات، ويُخصم من الربح في التقارير.">
        <a href={`/api/export/expenses?m=${ym}`} className="btn-ghost">تصدير Excel</a>
      </PageHead>

      <section className="panel mb-8 p-5">
        <h2 className="mb-4">مصروف جديد</h2>
        <ExpenseForm units={units} today={today} />
      </section>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link href={`/expenses?m=${addMonths(ym, -1)}`} className="btn-ghost px-3" aria-label="الشهر السابق">›</Link>
          <h2 className="min-w-[9rem] text-center">{monthName(ym)}</h2>
          <Link href={`/expenses?m=${addMonths(ym, 1)}`} className="btn-ghost px-3" aria-label="الشهر التالي">‹</Link>
        </div>
        <p className="text-lg">
          المجموع <strong>{money(total)}</strong>
        </p>
      </div>

      {cats.length > 0 && (
        <ul className="mb-4 flex flex-wrap gap-2 text-sm">
          {cats.map(([k, v]) => (
            <li key={k} className="rounded-full bg-white px-3 py-1 ring-1 ring-line">
              {EXPENSE_CATEGORIES[k]} <strong>{money(v)}</strong>
            </li>
          ))}
        </ul>
      )}

      {rows.length === 0 ? (
        <div className="panel px-6 py-10 text-center text-muted">لا توجد مصاريف مسجلة في {monthName(ym)}.</div>
      ) : (
        <div className="panel overflow-x-auto">
          <table className="table min-w-[640px]">
            <thead>
              <tr><th>التاريخ</th><th>البند</th><th>الوحدة</th><th>ملاحظة</th><th>المبلغ</th><th /></tr>
            </thead>
            <tbody>
              {rows.map((e) => (
                <tr key={e.id}>
                  <td>{prettyDate(e.spent_on)}</td>
                  <td>{EXPENSE_CATEGORIES[e.category] || e.category}</td>
                  <td>{e.unit_name || <span className="text-muted">عام</span>}</td>
                  <td className="text-muted">{e.note}</td>
                  <td className="font-semibold">{money(e.amount)}</td>
                  <td className="whitespace-nowrap text-end">
                    <Link href={`/expenses/${e.id}`} className="me-3 text-xs text-palm hover:underline">تعديل</Link>
                    <form action={deleteExpense} className="inline">
                      <input type="hidden" name="id" value={e.id} />
                      <ConfirmButton className="text-xs text-danger hover:underline" message="حذف هذا المصروف؟">حذف</ConfirmButton>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
