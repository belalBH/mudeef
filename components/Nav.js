'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const GROUPS = [
  [
    { href: '/dashboard', label: 'اليوم' },
    { href: '/calendar', label: 'التقويم' },
    { href: '/requests', label: 'طلبات الحجز', badge: 'pending' },
    { href: '/bookings', label: 'الحجوزات', badge: 'conflicts' },
    { href: '/guests', label: 'الضيوف' },
    { href: '/tasks', label: 'المهام والتنظيف', badge: 'tasks', cleaner: true },
  ],
  [
    { href: '/units', label: 'الوحدات' },
    { href: '/pricing', label: 'الأسعار والمواسم' },
    { href: '/channels', label: 'ربط المنصات' },
    { href: '/booking-page', label: 'صفحة الحجز المباشر' },
  ],
  [
    { href: '/expenses', label: 'المصاريف' },
    { href: '/owners', label: 'الملاك وكشوف الحساب' },
    { href: '/reports', label: 'التقارير' },
    { href: '/activity', label: 'سجل النشاط' },
    { href: '/team', label: 'الفريق', owner: true },
    { href: '/settings', label: 'الإعدادات' },
  ],
];

export default function Nav({ badges = {}, role = 'owner' }) {
  const path = usePathname();
  const groups = GROUPS.map((g) =>
    g.filter((it) => (role === 'cleaner' ? it.cleaner : !it.owner || role === 'owner'))
  ).filter((g) => g.length);
  return (
    <nav className="flex gap-1 overflow-x-auto lg:flex-col lg:gap-0 lg:overflow-visible">
      {groups.map((items, gi) => (
        <div key={gi} className={`flex gap-1 lg:flex-col ${gi ? 'lg:mt-2 lg:border-t lg:border-white/10 lg:pt-2' : ''}`}>
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
                  <span
                    className={`rounded-full px-1.5 text-xs font-bold ${
                      it.badge === 'conflicts' ? 'bg-danger text-white' : it.badge === 'pending' ? 'bg-white text-palm-dark' : 'bg-saffron text-ink'
                    }`}
                  >
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
