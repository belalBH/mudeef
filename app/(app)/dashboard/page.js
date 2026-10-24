import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { dashboard } from '@/lib/queries';
import { setStayStatus } from '@/lib/actions';
import { toggleTask } from '@/lib/actions-more';
import { addDays, diffDays, monthShort, nightsLabel, prettyDate, weekday } from '@/lib/dates';
import { money, num, sourceColor, sourceLabel } from '@/lib/constants';
import { SourceTag } from '@/components/badges';

export const metadata = { title: 'اليوم | مُضيف' };

const pct = (v) => `${Math.round(v * 100)}%`;

function Delta({ now, before, kind = 'pct' }) {
  if (!before && !now) return null;
  let text;
  let up;
  if (kind === 'points') {
    const d = Math.round((now - before) * 100);
    if (d === 0) return <span className="text-xs text-muted">نفس الشهر الماضي</span>;
    up = d > 0;
    text = `${up ? '+' : ''}${d} نقطة`;
  } else {
    if (!before) return <span className="text-xs text-muted">لا توجد بيانات للمقارنة</span>;
    const d = Math.round(((now - before) / before) * 100);
    if (d === 0) return <span className="text-xs text-muted">نفس الشهر الماضي</span>;
    up = d > 0;
    text = `${up ? '+' : ''}${d}%`;
  }
  return (
    <span className={`text-xs font-semibold ${up ? 'text-palm' : 'text-danger'}`}>
      {up ? '▲' : '▼'} {text} <span className="font-normal text-muted">عن نفس الفترة الشهر الماضي</span>
    </span>
  );
}

const STATE = {
  occupied: { label: 'مشغولة', bar: 'bg-palm', chip: 'bg-palm-soft text-palm-dark' },
  vacant: { label: 'فاضية', bar: 'bg-line', chip: 'bg-paper text-muted ring-1 ring-line' },
  dirty: { label: 'تحتاج تنظيف', bar: 'bg-saffron', chip: 'bg-saffron-soft text-ink' },
  blocked: { label: 'مغلقة', bar: 'bg-[#9AA39F]', chip: 'bg-line/60 text-muted' },
};

function StayButton({ id, to, label, early, primary }) {
  return (
    <form action={setStayStatus}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="to" value={to} />
      {early && <input type="hidden" name="early" value="1" />}
      <button className={`${primary ? 'btn-primary' : 'btn-ghost'} px-3 py-1.5 text-xs`}>{label}</button>
    </form>
  );
}

export default async function DashboardPage() {
  const user = await requireUser();
  const d = dashboard(user.account_id);

  if (d.units === 0) {
    return (
      <div className="max-w-xl py-10">
        <h1>أهلاً {user.name}</h1>
        <p className="mt-3 text-muted">ثلاث خطوات وتصير كل حجوزاتك في مكان واحد:</p>
        <ol className="mt-5 space-y-4">
          {[
            ['أضف وحداتك', 'كل غرفة أو استوديو تؤجره.'],
            ['اربط المنصات', 'الصق روابط تقويم Airbnb وBooking.com وجاذر إن.'],
            ['تابع من التقويم', 'كل الحجوزات في شاشة واحدة، والتعارضات تظهر فوراً.'],
          ].map(([t, s], i) => (
            <li key={t} className="flex gap-4">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-palm text-sm font-bold text-white">{i + 1}</span>
              <div>
                <p className="font-semibold">{t}</p>
                <p className="text-sm text-muted">{s}</p>
              </div>
            </li>
          ))}
        </ol>
        <Link href="/units/new" className="btn-primary mt-8">إضافة أول وحدة</Link>
      </div>
    );
  }

  const today = d.today;
  const tomorrow = addDays(today, 1);
  const label = (date) => (date === today ? 'اليوم' : date === tomorrow ? 'بكرة' : `${weekday(date)} ${prettyDate(date)}`);
  const arrivalsToday = d.arrivals.filter((b) => b.check_in === today);
  const arrivalsLater = d.arrivals.filter((b) => b.check_in !== today);
  const maxTrend = Math.max(1, ...d.trend.map((t) => Math.max(t.revenue, t.expenses)));
  const srcTotal = Object.values(d.month.bySource).reduce((a, v) => a + v, 0) || 1;
  const counts = d.board.reduce((a, b) => ({ ...a, [b.state]: (a[b.state] || 0) + 1 }), {});

  return (
    <>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-muted">{weekday(today)}، {prettyDate(today)} {today.slice(0, 4)}</p>
          <h1 className="mt-1">
            {d.inHouse === 0 ? 'لا يوجد ضيوف مقيمون الليلة' : `${num(d.inHouse)} من ${num(d.units)} وحدات مشغولة الليلة`}
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/bookings/new?block=1" className="btn-ghost">إغلاق تواريخ</Link>
          <Link href="/expenses" className="btn-ghost">مصروف جديد</Link>
          <Link href="/bookings/new" className="btn-primary">حجز جديد</Link>
        </div>
      </header>

      {/* Things that need attention first */}
      {(d.conflicts.length > 0 || d.syncErrors.length > 0 || d.lateCheckouts.length > 0 || d.noShows.length > 0) && (
        <section className="mb-8 grid gap-3 md:grid-cols-2" aria-label="تنبيهات">
          {d.conflicts.length > 0 && (
            <Link href="/bookings?view=conflicts" className="block rounded-lg border border-danger/30 bg-danger-soft p-4 hover:border-danger">
              <p className="font-semibold text-danger">يوجد {num(d.conflicts.length)} حجز متعارض</p>
              <p className="mt-1 text-sm">
                {d.conflicts.slice(0, 3).map((c) => `${c.unit_name} (${sourceLabel(c.source)} ${prettyDate(c.check_in)})`).join('، ')}
              </p>
            </Link>
          )}
          {d.syncErrors.map((c) => (
            <Link key={c.id} href={`/units/${c.unit_id}`} className="block rounded-lg border border-saffron/40 bg-saffron-soft p-4 hover:border-saffron">
              <p className="font-semibold">توقفت مزامنة {sourceLabel(c.source)} في {c.unit_name}</p>
              <p className="mt-1 text-sm text-muted">{c.last_sync_message}</p>
            </Link>
          ))}
          {d.lateCheckouts.length > 0 && (
            <div className="rounded-lg border border-saffron/40 bg-saffron-soft p-4">
              <p className="font-semibold">ضيوف انتهت إقامتهم ولم يُسجَّل خروجهم</p>
              <ul className="mt-2 space-y-2 text-sm">
                {d.lateCheckouts.map((b) => (
                  <li key={b.id} className="flex items-center justify-between gap-2">
                    <Link href={`/bookings/${b.id}`} className="underline underline-offset-2">{b.guest_name || 'ضيف'}، {b.unit_name}</Link>
                    <StayButton id={b.id} to="checked_out" label="تسجيل الخروج" />
                  </li>
                ))}
              </ul>
            </div>
          )}
          {d.noShows.length > 0 && (
            <div className="rounded-lg border border-saffron/40 bg-saffron-soft p-4">
              <p className="font-semibold">ضيوف كان المفروض وصلوا ولم يُسجَّل دخولهم</p>
              <ul className="mt-2 space-y-2 text-sm">
                {d.noShows.map((b) => (
                  <li key={b.id} className="flex flex-wrap items-center justify-between gap-2">
                    <Link href={`/bookings/${b.id}`} className="underline underline-offset-2">{b.guest_name || 'ضيف'}، {b.unit_name}، من {prettyDate(b.check_in)}</Link>
                    <span className="flex gap-1">
                      <StayButton id={b.id} to="checked_in" label="دخل" />
                      <StayButton id={b.id} to="no_show" label="لم يحضر" />
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {/* Month at a glance */}
      <dl className="mb-8 grid grid-cols-2 gap-x-6 gap-y-6 border-y border-line py-5 lg:grid-cols-4">
        <div>
          <dt className="text-sm text-muted">الصافي هذا الشهر حتى اليوم</dt>
          <dd className="mt-1 text-2xl font-bold">{money(d.monthToDate.revenue)}</dd>
          <Delta now={d.monthToDate.revenue} before={d.lastMonthToDate.revenue} />
          <p className="mt-1 text-xs text-muted">المتوقع للشهر كاملاً {money(d.month.revenue)}</p>
        </div>
        <div>
          <dt className="text-sm text-muted">الإشغال هذا الشهر</dt>
          <dd className="mt-1 text-2xl font-bold">{pct(d.monthToDate.occupancy)}</dd>
          <Delta now={d.monthToDate.occupancy} before={d.lastMonthToDate.occupancy} kind="points" />
          <div className="mt-2 h-1.5 w-full max-w-[10rem] rounded-full bg-line">
            <div className="h-full rounded-full bg-palm" style={{ width: `${Math.min(100, d.monthToDate.occupancy * 100)}%` }} />
          </div>
        </div>
        <div>
          <dt className="text-sm text-muted">متوسط سعر الليلة</dt>
          <dd className="mt-1 text-2xl font-bold">{money(d.monthToDate.adr)}</dd>
          <Delta now={d.monthToDate.adr} before={d.lastMonthToDate.adr} />
        </div>
        <div>
          <dt className="text-sm text-muted">صافي الربح بعد المصاريف</dt>
          <dd className={`mt-1 text-2xl font-bold ${d.monthToDate.profit < 0 ? 'text-danger' : ''}`}>{money(d.monthToDate.profit)}</dd>
          <p className="text-xs text-muted">مصاريف الشهر {money(d.monthToDate.expenses)}</p>
          <p className="text-xs text-muted">حجوزات جديدة {num(d.newThisMonth)} (الشهر الماضي {num(d.newLastMonth)})</p>
        </div>
      </dl>

      {/* Unit board */}
      <section className="mb-10">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <h2>حالة الوحدات الآن</h2>
          <p className="flex flex-wrap gap-3 text-sm text-muted">
            {Object.entries(STATE).map(([k, s]) => (counts[k] ? <span key={k}>{s.label} {counts[k]}</span> : null))}
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {d.board.map(({ unit, state, stay, leaving, next, cleaning }) => {
            const st = STATE[state];
            return (
              <article key={unit.id} className="panel flex flex-col overflow-hidden">
                <div className={`h-1.5 ${st.bar}`} />
                <div className="flex flex-1 flex-col p-4">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <Link href={`/units/${unit.id}`} className="truncate font-semibold hover:text-palm">{unit.name}</Link>
                    <span className={`shrink-0 rounded px-2 py-0.5 text-xs ${st.chip}`}>{st.label}</span>
                  </div>
                  <div className="flex-1 text-sm text-muted">
                    {state === 'occupied' && (
                      <p>
                        <Link href={`/bookings/${stay.id}`} className="font-medium text-ink hover:text-palm" dir="auto">{stay.guest_name || 'ضيف'}</Link>
                        <span className="block">حتى {label(stay.check_out)}، {sourceLabel(stay.source)}</span>
                        {stay.total_amount - stay.paid_amount > 0.5 && <span className="block text-saffron">متبقي {money(stay.total_amount - stay.paid_amount)}</span>}
                      </p>
                    )}
                    {state === 'blocked' && <p>{stay.notes || 'مغلقة'} حتى {prettyDate(stay.check_out)}</p>}
                    {leaving && <p className="mt-1">غادر اليوم: {leaving.guest_name || 'ضيف'}</p>}
                    {(state === 'vacant' || state === 'dirty') &&
                      (next ? (
                        <p>
                          الحجز القادم {label(next.check_in)}
                          <span className="block" dir="auto">{next.guest_name || 'ضيف'}</span>
                        </p>
                      ) : (
                        <p>لا يوجد حجز قادم</p>
                      ))}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {state === 'occupied' && stay.stay_status === 'upcoming' && <StayButton id={stay.id} to="checked_in" label="تسجيل الدخول" primary />}
                    {leaving && leaving.stay_status !== 'checked_out' && <StayButton id={leaving.id} to="checked_out" label="تسجيل الخروج" primary />}
                    {cleaning && (
                      <form action={toggleTask}>
                        <input type="hidden" name="id" value={cleaning.id} />
                        <button className="btn-ghost px-3 py-1.5 text-xs">تم التنظيف</button>
                      </form>
                    )}
                    {(state === 'vacant' || state === 'dirty') && (
                      <Link href={`/bookings/new?unit=${unit.id}&from=${today}&to=${tomorrow}`} className="btn-ghost px-3 py-1.5 text-xs">حجز الليلة</Link>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <div className="grid gap-10 xl:grid-cols-[1.35fr_1fr]">
        <div className="space-y-10">
          <section>
            <h2 className="mb-3">اليوم</h2>
            {arrivalsToday.length === 0 && d.departures.length === 0 ? (
              <p className="text-muted">لا يوجد وصول أو مغادرة اليوم.</p>
            ) : (
              <ul className="panel divide-y divide-line">
                {arrivalsToday.map((b) => (
                  <li key={`a${b.id}`} className="flex flex-wrap items-center gap-3 px-4 py-3">
                    <span className="w-14 shrink-0 text-sm font-semibold text-palm">وصول</span>
                    <Link href={`/bookings/${b.id}`} className="min-w-0 flex-1 hover:text-palm">
                      <span className="block truncate font-semibold" dir="auto">{b.guest_name || 'بدون اسم'}</span>
                      <span className="text-sm text-muted">{b.unit_name}، {nightsLabel(diffDays(b.check_in, b.check_out))}</span>
                    </Link>
                    <SourceTag source={b.source} />
                    {b.stay_status === 'upcoming' ? <StayButton id={b.id} to="checked_in" label="تسجيل الدخول" primary /> : <span className="text-xs text-palm">تم الدخول</span>}
                  </li>
                ))}
                {d.departures.map((b) => (
                  <li key={`d${b.id}`} className="flex flex-wrap items-center gap-3 px-4 py-3">
                    <span className="w-14 shrink-0 text-sm font-semibold text-saffron">مغادرة</span>
                    <Link href={`/bookings/${b.id}`} className="min-w-0 flex-1 hover:text-palm">
                      <span className="block truncate font-semibold" dir="auto">{b.guest_name || 'ضيف'}</span>
                      <span className="text-sm text-muted">{b.unit_name}</span>
                    </Link>
                    {b.total_amount - b.paid_amount > 0.5 && <span className="text-xs text-saffron">متبقي {money(b.total_amount - b.paid_amount)}</span>}
                    {b.stay_status !== 'checked_out' ? <StayButton id={b.id} to="checked_out" label="تسجيل الخروج" primary /> : <span className="text-xs text-palm">غادر</span>}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h2 className="mb-3">الوصول خلال الأيام القادمة</h2>
            {arrivalsLater.length === 0 ? (
              <p className="text-muted">لا يوجد ضيوف قادمون هذا الأسبوع.</p>
            ) : (
              <ul className="panel divide-y divide-line">
                {arrivalsLater.map((b) => (
                  <li key={b.id}>
                    <Link href={`/bookings/${b.id}`} className="flex items-center gap-4 px-4 py-3 hover:bg-paper/60">
                      <span className="w-24 shrink-0 text-sm text-muted">{label(b.check_in)}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold" dir="auto">{b.guest_name || 'بدون اسم'}</span>
                        <span className="block text-sm text-muted">{b.unit_name}، {nightsLabel(diffDays(b.check_in, b.check_out))}</span>
                      </span>
                      <SourceTag source={b.source} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-sm text-muted">
              الثلاثين يوماً القادمة: إشغال {pct(d.upcoming30.occupancy)}، وصافي متوقع {money(d.upcoming30.revenue)}.
            </p>
          </section>
        </div>

        <div className="space-y-10">
          <section>
            <div className="mb-3 flex items-end justify-between">
              <h2>مهام اليوم</h2>
              <Link href="/tasks" className="text-sm text-palm hover:underline">كل المهام</Link>
            </div>
            {d.tasksToday.length === 0 ? (
              <p className="text-muted">لا توجد مهام مستحقة اليوم.</p>
            ) : (
              <ul className="panel divide-y divide-line">
                {d.tasksToday.map((t) => (
                  <li key={t.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                    <form action={toggleTask}>
                      <input type="hidden" name="id" value={t.id} />
                      <button className="grid h-5 w-5 place-items-center rounded border-2 border-line hover:border-palm" aria-label="تم إنجاز المهمة" />
                    </form>
                    <span className="flex-1">
                      {t.unit_name}: {t.title}
                      {t.due_on < today && <span className="ms-1 text-danger">(متأخرة)</span>}
                    </span>
                    {t.assignee && <span className="text-xs text-muted">{t.assignee}</span>}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <div className="mb-3 flex items-end justify-between">
              <h2>مبالغ لم تُحصّل</h2>
              <Link href="/bookings?view=due" className="text-sm text-palm hover:underline">الكل</Link>
            </div>
            {d.dues.length === 0 ? (
              <p className="text-muted">كل الضيوف الحاليين والقادمين دفعوا.</p>
            ) : (
              <>
                <p className="mb-2 text-sm">مستحق من إقامات بدأت: <strong className="text-saffron">{money(d.dueTotal)}</strong></p>
                <ul className="panel divide-y divide-line">
                  {d.dues.map((b) => (
                    <li key={b.id}>
                      <Link href={`/bookings/${b.id}`} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm hover:bg-paper/60">
                        <span>
                          <span className="font-semibold" dir="auto">{b.guest_name || 'ضيف'}</span>
                          <span className="block text-muted">{b.unit_name}، {label(b.check_in)}</span>
                        </span>
                        <span className="font-semibold text-saffron">{money(b.total_amount - b.paid_amount)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>

          <section>
            <div className="mb-3 flex items-end justify-between">
              <h2>آخر 6 أشهر</h2>
              <Link href="/reports" className="text-sm text-palm hover:underline">التقارير</Link>
            </div>
            <div className="panel p-4">
              <div className="flex items-end gap-3" style={{ height: 130 }}>
                {d.trend.map((t) => (
                  <div key={t.ym} className="flex h-full flex-1 flex-col justify-end">
                    <div className="flex items-end justify-center gap-0.5">
                      <div className="w-full max-w-[22px] rounded-t bg-palm" style={{ height: `${(t.revenue / maxTrend) * 110}px`, minHeight: t.revenue ? 2 : 0 }} title={money(t.revenue)} />
                      <div className="w-1.5 rounded-t bg-danger/70" style={{ height: `${(t.expenses / maxTrend) * 110}px`, minHeight: t.expenses ? 2 : 0 }} title={money(t.expenses)} />
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-1.5 flex gap-3 border-t border-line pt-1.5">
                {d.trend.map((t) => (
                  <div key={t.ym} className="flex-1 text-center text-[11px]">
                    <div className={t.ym === today.slice(0, 7) ? 'font-bold' : 'text-muted'}>{monthShort(Number(t.ym.slice(5)))}</div>
                    <div className="text-muted">{pct(t.occupancy)}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {Object.keys(d.month.bySource).length > 0 && (
            <section>
              <h2 className="mb-3">مصادر حجوزات هذا الشهر</h2>
              <div className="mb-3 flex h-3 overflow-hidden rounded-full">
                {Object.entries(d.month.bySource).map(([k, v]) => (
                  <div key={k} style={{ width: `${(v / srcTotal) * 100}%`, background: sourceColor(k) }} title={sourceLabel(k)} />
                ))}
              </div>
              <ul className="space-y-1 text-sm">
                {Object.entries(d.month.bySource).sort((a, b) => b[1] - a[1]).map(([k, v]) => (
                  <li key={k} className="flex justify-between">
                    <SourceTag source={k} />
                    <span>{money(v)} <span className="text-muted">({pct(v / srcTotal)})</span></span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {d.unpriced > 0 && (
            <p className="rounded-md bg-saffron-soft px-4 py-3 text-sm">
              {num(d.unpriced)} حجز مستورد من المنصات بدون مبلغ. أضف المبالغ لتظهر الإيرادات صحيحة.{' '}
              <Link href="/bookings?view=all" className="font-semibold underline underline-offset-2">عرض الحجوزات</Link>
            </p>
          )}
        </div>
      </div>
    </>
  );
}
