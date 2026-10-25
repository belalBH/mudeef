import Link from 'next/link';
import { requireUser, ROLES } from '@/lib/auth';
import { logout } from '@/lib/actions';
import { db } from '@/lib/db';
import { todayISO } from '@/lib/dates';
import Logo from '@/components/Logo';
import Nav from '@/components/Nav';

export default async function AppLayout({ children }) {
  const user = await requireUser(['owner', 'manager', 'cleaner']);
  const today = todayISO();
  const one = (sql, ...a) => db.prepare(sql).get(...a).n;
  const cleaner = user.role === 'cleaner';
  const badges = {
    conflicts: one(`SELECT COUNT(*) n FROM bookings WHERE account_id = ? AND conflict = 1 AND status = 'confirmed' AND check_out >= ?`, user.account_id, today),
    tasks: cleaner
      ? one(`SELECT COUNT(*) n FROM tasks WHERE account_id = ? AND status = 'open' AND due_on <= ? AND (assignee IS NULL OR assignee = '' OR assignee = ?)`, user.account_id, today, user.name)
      : one(`SELECT COUNT(*) n FROM tasks WHERE account_id = ? AND status = 'open' AND due_on <= ?`, user.account_id, today),
    pending: one(`SELECT COUNT(*) n FROM bookings WHERE account_id = ? AND status = 'pending'`, user.account_id),
  };

  return (
    <div className="lg:grid lg:min-h-screen lg:grid-cols-[236px_1fr]">
      <aside className="sticky top-0 z-20 bg-palm-dark px-3 py-3 print:hidden lg:flex lg:h-screen lg:flex-col lg:overflow-y-auto lg:px-4 lg:py-5">
        <div className="flex items-center justify-between lg:block">
          <Link href={cleaner ? '/tasks' : '/dashboard'} className="block px-2">
            <Logo light />
          </Link>
          <div className="flex items-center gap-4 lg:hidden">
            {!cleaner && <Link href="/search" className="text-sm text-white/80 hover:text-white">بحث</Link>}
            <form action={logout}>
              <button className="text-sm text-white/70 hover:text-white">خروج</button>
            </form>
          </div>
        </div>
        <p className="mt-1 hidden truncate px-2 text-sm text-white/60 lg:block">{user.account_name}</p>
        {!cleaner && (
          <form action="/search" className="mt-4 hidden lg:block" role="search">
            <input
              name="q"
              placeholder="ابحث: ضيف، جوال، رقم حجز"
              aria-label="بحث"
              className="w-full rounded-md border border-white/15 bg-white/10 px-3 py-1.5 text-sm text-white placeholder:text-white/50 focus:border-white/40 focus:outline-none"
            />
          </form>
        )}
        <div className="mt-3 lg:mt-4">
          <Nav badges={badges} role={user.role} />
        </div>
        <div className="mt-auto hidden pt-5 lg:block">
          {!cleaner && (
            <Link href="/bookings/new" className="btn w-full bg-saffron text-ink hover:bg-saffron/90">
              حجز جديد
            </Link>
          )}
          <div className="mt-4 border-t border-white/10 pt-3 text-sm">
            <Link href="/settings#profile" className="block truncate text-white/80 hover:text-white">{user.name}</Link>
            <span className="block text-xs text-white/50">{ROLES[user.role]}</span>
            <form action={logout}>
              <button className="mt-1 text-white/60 hover:text-white">تسجيل الخروج</button>
            </form>
          </div>
        </div>
      </aside>
      <main className="min-w-0 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">{children}</main>
      {!cleaner && (
        <Link
          href="/bookings/new"
          className="fixed bottom-5 start-5 z-30 grid h-14 w-14 place-items-center rounded-full bg-saffron text-2xl font-bold text-ink shadow-lg print:hidden lg:hidden"
          aria-label="حجز جديد"
        >
          +
        </Link>
      )}
    </div>
  );
}
