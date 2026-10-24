'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const ITEMS = [
  { href: '/dashboard', label: 'اليوم' },
  { href: '/calendar', label: 'التقويم' },
  { href: '/bookings', label: 'الحجوزات' },
  { href: '/units', label: 'الوحدات' },
  { href: '/channels', label: 'ربط المنصات' },
  { href: '/reports', label: 'التقارير' },
];

export default function Nav({ conflicts = 0 }) {
  const path = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
      {ITEMS.map((it) => {
        const active = path === it.href || path.startsWith(it.href + '/');
        return (
          <Link
            key={it.href}
            href={it.href}
            aria-current={active ? 'page' : undefined}
            className={`flex shrink-0 items-center justify-between gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
              active ? 'bg-white/10 font-semibold text-white' : 'text-white/70 hover:bg-white/5 hover:text-white'
            }`}
          >
            {it.label}
            {it.href === '/bookings' && conflicts > 0 && (
              <span className="rounded-full bg-danger px-1.5 text-xs font-bold text-white">{conflicts}</span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
