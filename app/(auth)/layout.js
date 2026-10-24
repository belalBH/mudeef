import { redirect } from 'next/navigation';
import { getUser } from '@/lib/auth';
import Logo from '@/components/Logo';

export default async function AuthLayout({ children }) {
  if (await getUser()) redirect('/dashboard');
  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_1.1fr]">
      <main className="flex items-center justify-center px-5 py-12">
        <div className="w-full max-w-sm">
          <Logo />
          <div className="mt-10">{children}</div>
        </div>
      </main>
      <aside className="relative hidden overflow-hidden bg-palm-dark lg:block" aria-hidden>
        <div className="absolute inset-0 flex flex-col justify-center gap-5 px-14">
          {[
            [8, 40, '#D9555B'], [52, 30, '#2A5BA8'],
            [20, 46, '#6B4BB4'], [70, 22, '#C8902E'],
            [0, 26, '#FFFFFF'], [30, 34, '#D9555B'], [68, 28, '#6B4BB4'],
            [14, 38, '#2A5BA8'], [56, 36, '#C8902E'],
          ].map(([start, width, color], i) => (
            <div key={i} className="relative h-7">
              <div className="absolute inset-y-0 rounded-full opacity-90" style={{ insetInlineStart: `${start}%`, width: `${width}%`, background: color }} />
            </div>
          ))}
        </div>
        <p className="absolute bottom-12 start-14 max-w-sm text-lg leading-relaxed text-white/90">
          حجوزات Airbnb وBooking.com وجاذر إن في تقويم واحد، بلا حجز مزدوج.
        </p>
      </aside>
    </div>
  );
}
