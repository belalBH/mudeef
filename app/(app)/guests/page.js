import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { listGuests } from '@/lib/queries';
import { money, num } from '@/lib/constants';
import { prettyDate } from '@/lib/dates';
import PageHead from '@/components/PageHead';
import { GuestForm } from '@/components/forms';

export const metadata = { title: 'الضيوف | مُضيف' };

export default async function GuestsPage({ searchParams }) {
  const user = await requireUser();
  const sp = await searchParams;
  const q = (sp.q || '').trim();
  const guests = listGuests(user.account_id, q);
  const repeat = guests.filter((g) => g.stays > 1).length;

  return (
    <>
      <PageHead title="الضيوف" sub={`${num(guests.length)} ضيف، منهم ${num(repeat)} تكررت إقامتهم. يُضاف الضيف تلقائياً مع أول حجز له.`}>
        <a href="/api/export/guests" className="btn-ghost">تصدير Excel</a>
      </PageHead>

      <details className="panel mb-6 p-5">
        <summary className="cursor-pointer font-semibold text-palm">إضافة ضيف يدوياً</summary>
        <div className="mt-4"><GuestForm /></div>
      </details>

      <form className="mb-4 flex gap-2" action="/guests">
        <input name="q" defaultValue={q} placeholder="ابحث بالاسم أو الجوال" className="field w-72" />
        <button className="btn-ghost">بحث</button>
      </form>

      {guests.length === 0 ? (
        <div className="panel px-6 py-10 text-center text-muted">{q ? 'لا يوجد ضيف بهذا الاسم أو الرقم.' : 'لا يوجد ضيوف بعد. سجّل حجزاً وسيظهر الضيف هنا.'}</div>
      ) : (
        <div className="panel overflow-x-auto">
          <table className="table min-w-[640px]">
            <thead>
              <tr><th>الضيف</th><th>الجوال</th><th>الإقامات</th><th>إجمالي ما دفعه</th><th>آخر إقامة</th></tr>
            </thead>
            <tbody>
              {guests.map((g) => (
                <tr key={g.id} className="hover:bg-paper/60">
                  <td>
                    <Link href={`/guests/${g.id}`} className="font-semibold hover:text-palm" dir="auto">{g.name}</Link>
                    {g.blacklisted ? <span className="ms-2 rounded bg-danger-soft px-1.5 text-xs text-danger">محظور</span> : null}
                    {g.stays > 1 && !g.blacklisted ? <span className="ms-2 rounded bg-saffron-soft px-1.5 text-xs">متكرر</span> : null}
                  </td>
                  <td dir="ltr" className="text-end">{g.phone || '—'}</td>
                  <td>{num(g.stays)}</td>
                  <td>{money(g.spent)}</td>
                  <td>{g.last_stay ? prettyDate(g.last_stay) + ' ' + g.last_stay.slice(0, 4) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
