import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { getExpense, listUnits } from '@/lib/queries';
import { todayISO } from '@/lib/dates';
import { ExpenseForm } from '@/components/forms';

export default async function EditExpensePage({ params }) {
  const user = await requireUser();
  const { id } = await params;
  const e = getExpense(user.account_id, Number(id));
  if (!e) notFound();
  return (
    <div className="max-w-4xl">
      <Link href={`/expenses?m=${e.spent_on.slice(0, 7)}`} className="text-sm text-muted hover:text-palm">المصاريف</Link>
      <h1 className="mb-6 mt-1">تعديل مصروف</h1>
      <div className="panel p-5">
        <ExpenseForm units={listUnits(user.account_id)} today={todayISO()} expense={e} />
      </div>
    </div>
  );
}
