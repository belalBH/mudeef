import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { getAccount } from '@/lib/queries';
import { ownerPayouts, ownerStatement } from '@/lib/queries-v3';
import { deleteOwner, recordPayout, undoPayout } from '@/lib/actions-v3';
import { addMonths, monthName, prettyDate, todayISO } from '@/lib/dates';
import { EXPENSE_CATEGORIES, money, num, sourceLabel } from '@/lib/constants';
import { OwnerForm } from '@/components/forms-v3';
import PrintButton from '@/components/PrintButton';
import { ConfirmButton } from '@/components/ui';

export default async function OwnerPage({ params, searchParams }) {
  const user = await requireUser();
  const { id } = await params;
  const sp = await searchParams;
  const ym = /^\d{4}-\d{2}$/.test(sp.m || '') ? sp.m : addMonths(todayISO().slice(0, 7), -1);
  const st = ownerStatement(user.account_id, Number(id), ym);
  if (!st) notFound();
  const { owner } = st;
  const acc = getAccount(user.account_id);
  const payouts = ownerPayouts(user.account_id, owner.id);

  return (
    <div className="max-w-5xl">
      <div className="print:hidden">
        <Link href="/owners" className="text-sm text-muted hover:text-palm">الملاك</Link>
        <div className="mb-6 mt-1 flex flex-wrap items-center justify-between gap-3">
          <h1>{owner.name}</h1>
          <div className="flex items-center gap-2">
            <Link href={`/owners/${owner.id}?m=${addMonths(ym, -1)}`} className="btn-ghost px-3" aria-label="الشهر السابق">›</Link>
            <span className="min-w-[8rem] text-center font-semibold">{monthName(ym)}</span>
            <Link href={`/owners/${owner.id}?m=${addMonths(ym, 1)}`} className="btn-ghost px-3" aria-label="الشهر التالي">‹</Link>
            <PrintButton label="طباعة الكشف" />
          </div>
        </div>
      </div>

      {/* Statement */}
      <article className="panel mb-10 p-6 print:border-0 print:p-0">
        <header className="mb-6 flex flex-wrap justify-between gap-4 border-b border-line pb-4">
          <div>
            <p className="text-sm text-muted">{acc.name}</p>
            <h2 className="text-xl">كشف حساب المالك: {owner.name}</h2>
            <p className="text-muted">عن شهر {monthName(ym)}</p>
          </div>
          <div className="text-end text-sm">
            <p>الوحدات: {st.units.map((u) => u.name).join('، ') || 'لا توجد وحدات مرتبطة'}</p>
            <p className="text-muted">الإشغال {Math.round(st.occupancy * 100)}%، {num(st.nights)} ليلة</p>
            {owner.iban && <p className="font-mono text-xs" dir="ltr">{owner.iban}</p>}
          </div>
        </header>

        {st.units.length === 0 ? (
          <p className="text-muted">
            لم تُربط أي وحدة بهذا المالك بعد. افتح صفحة الوحدة واختر المالك من حقل "المالك".
          </p>
        ) : (
          <>
            <h3 className="mb-2 font-semibold">الإقامات</h3>
            {st.lines.length === 0 ? (
              <p className="mb-6 text-sm text-muted">لا توجد إقامات في هذا الشهر.</p>
            ) : (
              <div className="mb-6 overflow-x-auto">
                <table className="table min-w-[620px]">
                  <thead><tr><th>الوحدة</th><th>الضيف</th><th>الفترة</th><th>الليالي</th><th>المصدر</th><th>الإيراد</th><th>العمولة</th><th>الصافي</th></tr></thead>
                  <tbody>
                    {st.lines.map((l) => (
                      <tr key={l.id}>
                        <td>{l.unit_name}</td>
                        <td dir="auto">{l.guest_name || '—'}</td>
                        <td className="whitespace-nowrap">{prettyDate(l.check_in)} - {prettyDate(l.check_out)}</td>
                        <td>{l.nights_in}</td>
                        <td>{sourceLabel(l.source)}</td>
                        <td>{money(l.gross)}</td>
                        <td>{money(l.commission_in)}</td>
                        <td>{money(l.net)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <h3 className="mb-2 font-semibold">المصاريف</h3>
            {st.expenses.length === 0 ? (
              <p className="mb-6 text-sm text-muted">لا توجد مصاريف على وحدات هذا المالك.</p>
            ) : (
              <table className="table mb-6">
                <tbody>
                  {st.expenses.map((e) => (
                    <tr key={e.id}>
                      <td>{prettyDate(e.spent_on)}</td>
                      <td>{e.unit_name}</td>
                      <td>{EXPENSE_CATEGORIES[e.category]}</td>
                      <td className="text-muted">{e.note}</td>
                      <td className="text-end">{money(e.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <dl className="ms-auto max-w-sm space-y-1.5 text-sm">
              <div className="flex justify-between"><dt>إجمالي الإيرادات</dt><dd>{money(st.gross)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">عمولات المنصات</dt><dd>- {money(st.commissions)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">رسوم الإدارة {owner.fee_pct}%</dt><dd>- {money(st.fee)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">المصاريف</dt><dd>- {money(st.expTotal)}</dd></div>
              <div className="flex justify-between border-t border-line pt-2 text-base font-bold">
                <dt>المستحق للمالك</dt>
                <dd className={st.payable < 0 ? 'text-danger' : ''}>{money(st.payable)}</dd>
              </div>
              {st.payout && <div className="flex justify-between text-palm"><dt>حُوّل بتاريخ {prettyDate(st.payout.paid_on)}</dt><dd>{money(st.payout.amount)}</dd></div>}
            </dl>
          </>
        )}
      </article>

      <div className="grid gap-8 print:hidden lg:grid-cols-2">
        <section>
          <h2 className="mb-3">تسجيل التحويل</h2>
          <div className="panel p-5">
            {st.payout ? (
              <form action={undoPayout} className="flex items-center justify-between gap-3">
                <input type="hidden" name="id" value={st.payout.id} />
                <p>تم تسجيل تحويل {money(st.payout.amount)} عن {monthName(ym)}.</p>
                <button className="text-sm text-danger hover:underline">تراجع</button>
              </form>
            ) : (
              <form action={recordPayout} className="flex flex-wrap items-end gap-3">
                <input type="hidden" name="owner_id" value={owner.id} />
                <input type="hidden" name="period" value={ym} />
                <div>
                  <label className="label" htmlFor="pamount">المبلغ المحوّل</label>
                  <input id="pamount" name="amount" type="number" step="0.01" className="field w-40" defaultValue={Math.max(0, Math.round(st.payable * 100) / 100)} />
                </div>
                <div className="flex-1">
                  <label className="label" htmlFor="pnote">ملاحظة</label>
                  <input id="pnote" name="note" className="field" placeholder="رقم الحوالة" />
                </div>
                <button className="btn-primary">تسجيل كمحوّل</button>
              </form>
            )}
          </div>
          {payouts.length > 0 && (
            <>
              <h3 className="mb-2 mt-6 font-semibold">التحويلات السابقة</h3>
              <ul className="panel divide-y divide-line text-sm">
                {payouts.map((p) => (
                  <li key={p.id} className="flex justify-between px-4 py-2">
                    <Link href={`/owners/${owner.id}?m=${p.period}`} className="hover:text-palm">{monthName(p.period)}</Link>
                    <span>{money(p.amount)}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
        <section>
          <h2 className="mb-3">بيانات المالك</h2>
          <div className="panel p-5"><OwnerForm owner={owner} /></div>
          <form action={deleteOwner} className="mt-3">
            <input type="hidden" name="id" value={owner.id} />
            <ConfirmButton message={`حذف ${owner.name}؟ الوحدات تبقى لكن بدون مالك.`}>حذف المالك</ConfirmButton>
          </form>
        </section>
      </div>
    </div>
  );
}
