'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const GROUPS = [
  [
    { href: '/dashboard', label: 'اليوم' },
    { href: '/calendar', label: 'التقويم' },
    { href: '/bookings', label: 'الحجوزات', badge: 'conflicts' },
    { href: '/guests', label: 'الضيوف' },
    { href: '/tasks', label: 'المهام والتنظيف', badge: 'tasks' },
  ],
  [
    { href: '/units', label: 'الوحدات' },
    { href: '/pricing', label: 'الأسعار والمواسم' },
    { href: '/channels', label: 'ربط المنصات' },
  ],
  [
    { href: '/expenses', label: 'المصاريف' },
    { href: '/reports', label: 'التقارير' },
    { href: '/settings', label: 'الإعدادات' },
  ],
];

export default function Nav({ badges = {} }) {
  const path = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto lg:flex-col lg:gap-0 lg:overflow-visible">
      {GROUPS.map((items, gi) => (
        <div key={gi} className={`flex gap-1 lg:flex-col ${gi ? 'lg:mt-3 lg:border-t lg:border-white/10 lg:pt-3' : ''}`}>
          {items.map((it) => {
            const active = path === it.href || path.startsWith(it.href + '/');
            const n = it.badge ? badges[it.badge] : 0;
            return (
              <Link
                key={it.href}
                href={it.href}
                aria-current={active ? 'page' : undefined}
                className={`flex shrink-0 items-center justify-between gap-3 rounded-md px-3 py-1.5 text-sm transition-colors ${
                  active ? 'bg-white/10 font-semibold text-white' : 'text-white/70 hover:bg-white/5 hover:text-white'
                }`}
              >
                {it.label}
                {n > 0 && (
                  <span className={`rounded-full px-1.5 text-xs font-bold ${it.badge === 'conflicts' ? 'bg-danger text-white' : 'bg-saffron text-ink'}`}>
                    {n}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
