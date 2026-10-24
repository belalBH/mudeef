import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { logout } from '@/lib/actions';
import { db } from '@/lib/db';
import { todayISO } from '@/lib/dates';
import Logo from '@/components/Logo';
import Nav from '@/components/Nav';

export default async function AppLayout({ children }) {
  const user = await requireUser();
  const conflicts = db
    .prepare(`SELECT COUNT(*) n FROM bookings WHERE account_id = ? AND conflict = 1 AND status != 'cancelled' AND check_out >= ?`)
    .get(user.account_id, todayISO()).n;

  return (
    <div className="lg:grid lg:min-h-screen lg:grid-cols-[230px_1fr]">
      <aside className="sticky top-0 z-20 bg-palm-dark px-3 py-3 lg:h-screen lg:px-4 lg:py-6">
        <div className="flex items-center justify-between lg:block">
          <Link href="/dashboard" className="block px-2">
            <Logo light />
          </Link>
          <form action={logout} className="lg:hidden">
            <button className="text-sm text-white/70 hover:text-white">خروج</button>
          </form>
        </div>
        <p className="mt-1 hidden truncate px-2 text-sm text-white/60 lg:block">{user.account_name}</p>
        <div className="mt-3 lg:mt-8">
          <Nav conflicts={conflicts} />
        </div>
        <div className="absolute inset-x-4 bottom-6 hidden lg:block">
          <Link href="/bookings/new" className="btn w-full bg-saffron text-ink hover:bg-saffron/90">
            حجز جديد
          </Link>
          <div className="mt-5 border-t border-white/10 pt-4 text-sm">
            <p className="truncate text-white/80">{user.name}</p>
            <form action={logout}>
              <button className="mt-1 text-white/60 hover:text-white">تسجيل الخروج</button>
            </form>
          </div>
        </div>
      </aside>
      <main className="min-w-0 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">{children}</main>
    </div>
  );
}
