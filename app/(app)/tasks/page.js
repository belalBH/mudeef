import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { assignees, listTasks, listUnits } from '@/lib/queries';
import { assignTask, deleteTask, toggleTask } from '@/lib/actions-more';
import { prettyDate, todayISO, weekday } from '@/lib/dates';
import { TASK_TYPES } from '@/lib/constants';
import PageHead from '@/components/PageHead';
import { TaskForm } from '@/components/forms';
import { ConfirmButton } from '@/components/ui';

export const metadata = { title: 'المهام والتنظيف | مُضيف' };

const VIEWS = [
  ['today', 'اليوم والمتأخرة'],
  ['open', 'كل المفتوحة'],
  ['done', 'المنجزة'],
];

export default async function TasksPage({ searchParams }) {
  const user = await requireUser();
  const sp = await searchParams;
  const view = VIEWS.some(([k]) => k === sp.view) ? sp.view : 'today';
  const today = todayISO();
  const units = listUnits(user.account_id, { activeOnly: true });
  const tasks = listTasks(user.account_id, view);
  const people = assignees(user.account_id);

  return (
    <>
      <PageHead title="المهام والتنظيف" sub="مهمة تنظيف تنشأ تلقائياً يوم خروج كل ضيف، وتقدر تضيف مهام صيانة أو فحص." />

      {units.length > 0 && (
        <details className="panel mb-6 p-5">
          <summary className="cursor-pointer font-semibold text-palm">مهمة جديدة</summary>
          <div className="mt-4">
            <TaskForm units={units} today={today} people={people} />
          </div>
        </details>
      )}

      <div className="mb-4 flex gap-1 border-b border-line">
        {VIEWS.map(([k, label]) => (
          <Link
            key={k}
            href={`/tasks?view=${k}`}
            className={`-mb-px border-b-2 px-3 py-2 text-sm ${view === k ? 'border-palm font-semibold text-palm' : 'border-transparent text-muted hover:text-ink'}`}
          >
            {label}
          </Link>
        ))}
      </div>

      {tasks.length === 0 ? (
        <div className="panel px-6 py-10 text-center text-muted">{view === 'done' ? 'لا توجد مهام منجزة بعد.' : 'لا توجد مهام هنا. كل شي نظيف.'}</div>
      ) : (
        <ul className="panel divide-y divide-line">
          {tasks.map((t) => {
            const late = t.status === 'open' && t.due_on < today;
            return (
              <li key={t.id} className="flex flex-wrap items-center gap-4 px-4 py-3">
                <form action={toggleTask}>
                  <input type="hidden" name="id" value={t.id} />
                  <button
                    className={`grid h-6 w-6 place-items-center rounded border-2 text-sm ${t.status === 'done' ? 'border-palm bg-palm text-white' : 'border-line hover:border-palm'}`}
                    aria-label={t.status === 'done' ? 'إعادة فتح المهمة' : 'تم إنجاز المهمة'}
                  >
                    {t.status === 'done' ? '✓' : ''}
                  </button>
                </form>
                <div className="min-w-0 flex-1">
                  <p className={`font-semibold ${t.status === 'done' ? 'text-muted line-through' : ''}`}>
                    {t.unit_name}: {t.title || TASK_TYPES[t.type]}
                  </p>
                  <p className="text-sm text-muted">
                    <span className={late ? 'font-semibold text-danger' : ''}>
                      {t.due_on === today ? 'اليوم' : `${weekday(t.due_on)} ${prettyDate(t.due_on)}`}
                      {late && '، متأخرة'}
                    </span>
                    {t.booking_id && (
                      <>
                        {'، بعد خروج '}
                        <Link href={`/bookings/${t.booking_id}`} className="underline underline-offset-2">{t.guest_name || 'الضيف'}</Link>
                      </>
                    )}
                    {t.note && `، ${t.note}`}
                  </p>
                </div>
                <form action={assignTask} className="flex items-center gap-1">
                  <input type="hidden" name="id" value={t.id} />
                  <input name="assignee" defaultValue={t.assignee || ''} list="people-list" placeholder="المسؤول" aria-label="المسؤول" className="field w-32 py-1 text-sm" />
                  <button className="text-xs text-palm hover:underline">تعيين</button>
                </form>
                <form action={deleteTask}>
                  <input type="hidden" name="id" value={t.id} />
                  <ConfirmButton className="text-xs text-danger hover:underline" message="حذف المهمة؟">حذف</ConfirmButton>
                </form>
              </li>
            );
          })}
        </ul>
      )}
      <datalist id="people-list">
        {people.map((p) => <option key={p} value={p} />)}
      </datalist>
    </>
  );
}
