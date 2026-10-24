import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { logout } from '@/lib/actions';
import { db } from '@/lib/db';
import { todayISO } from '@/lib/dates';
import Logo from '@/components/Logo';
import Nav from '@/components/Nav';

export default async function AppLayout({ children }) {
  const user = await requireUser();
  const today = todayISO();
  const conflicts = db
    .prepare(`SELECT COUNT(*) n FROM bookings WHERE account_id = ? AND conflict = 1 AND status != 'cancelled' AND check_out >= ?`)
    .get(user.account_id, today).n;
  const tasks = db
    .prepare(`SELECT COUNT(*) n FROM tasks WHERE account_id = ? AND status = 'open' AND due_on <= ?`)
    .get(user.account_id, today).n;

  return (
    <div className="lg:grid lg:min-h-screen lg:grid-cols-[230px_1fr]">
      <aside className="sticky top-0 z-20 bg-palm-dark px-3 py-3 print:hidden lg:flex lg:h-screen lg:flex-col lg:overflow-y-auto lg:px-4 lg:py-6">
        <div className="flex items-center justify-between lg:block">
          <Link href="/dashboard" className="block px-2">
            <Logo light />
          </Link>
          <form action={logout} className="lg:hidden">
            <button className="text-sm text-white/70 hover:text-white">خروج</button>
          </form>
        </div>
        <p className="mt-1 hidden truncate px-2 text-sm text-white/60 lg:block">{user.account_name}</p>
        <div className="mt-3 lg:mt-6">
          <Nav badges={{ conflicts, tasks }} />
        </div>
        <div className="mt-auto hidden pt-6 lg:block">
          <Link href="/bookings/new" className="btn w-full bg-saffron text-ink hover:bg-saffron/90">
            حجز جديد
          </Link>
          <div className="mt-4 border-t border-white/10 pt-3 text-sm">
            <Link href="/settings#profile" className="block truncate text-white/80 hover:text-white">{user.name}</Link>
            <form action={logout}>
              <button className="mt-1 text-white/60 hover:text-white">تسجيل الخروج</button>
            </form>
          </div>
        </div>
      </aside>
      <main className="min-w-0 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">{children}</main>
      <Link
        href="/bookings/new"
        className="fixed bottom-5 start-5 z-30 grid h-14 w-14 place-items-center rounded-full bg-saffron text-2xl font-bold text-ink shadow-lg print:hidden lg:hidden"
        aria-label="حجز جديد"
      >
        +
      </Link>
    </div>
  );
}
