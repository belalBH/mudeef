import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { getAccount } from '@/lib/queries';
import { db } from '@/lib/db';
import { templatesFor } from '@/lib/templates';
import PageHead from '@/components/PageHead';
import { BusinessForm, PasswordForm, ProfileForm, TemplatesForm } from '@/components/forms';

export const metadata = { title: 'الإعدادات | مُضيف' };

export default async function SettingsPage() {
  const user = await requireUser(['owner', 'manager', 'cleaner']);
  const cleaner = user.role === 'cleaner';
  const serverAdmin = db.prepare("SELECT MIN(id) id FROM users WHERE role = 'owner'").get().id === user.id;
  const account = getAccount(user.account_id);
  return (
    <div className="max-w-3xl">
      <PageHead title="الإعدادات" />
      {!cleaner && <nav className="mb-8 flex flex-wrap gap-2 text-sm" aria-label="أقسام الإعدادات">
        <a href="#business" className="rounded-full bg-white px-3 py-1 ring-1 ring-line hover:ring-palm">بيانات النشاط</a>
        <a href="#messages" className="rounded-full bg-white px-3 py-1 ring-1 ring-line hover:ring-palm">رسائل واتساب</a>
        <a href="#profile" className="rounded-full bg-white px-3 py-1 ring-1 ring-line hover:ring-palm">حسابي</a>
        <a href="#password" className="rounded-full bg-white px-3 py-1 ring-1 ring-line hover:ring-palm">كلمة المرور</a>
        {user.role === 'owner' && <a href="#backup" className="rounded-full bg-white px-3 py-1 ring-1 ring-line hover:ring-palm">النسخ الاحتياطي</a>}
        <Link href="/booking-page" className="rounded-full bg-white px-3 py-1 ring-1 ring-line hover:ring-palm">صفحة الحجز المباشر</Link>
        {user.role === 'owner' && <Link href="/team" className="rounded-full bg-white px-3 py-1 ring-1 ring-line hover:ring-palm">الفريق</Link>}
      </nav>}

      {!cleaner && (<>
      <section id="business" className="mb-10 scroll-mt-6">
        <h2 className="mb-1">بيانات النشاط</h2>
        <p className="mb-3 text-sm text-muted">تظهر في الفواتير والرسائل.</p>
        <div className="panel p-5"><BusinessForm account={account} /></div>
      </section>

      <section id="messages" className="mb-10 scroll-mt-6">
        <h2 className="mb-1">رسائل واتساب الجاهزة</h2>
        <p className="mb-3 text-sm text-muted">تظهر كأزرار في صفحة كل حجز، وتفتح واتساب برسالة معبأة باسم الضيف وتفاصيل حجزه.</p>
        <div className="panel p-5"><TemplatesForm templates={templatesFor(account)} /></div>
      </section>

      </>)}

      <section id="profile" className="mb-10 scroll-mt-6">
        <h2 className="mb-3">حسابي</h2>
        <div className="panel p-5"><ProfileForm user={user} /></div>
      </section>

      <section id="password" className="mb-10 scroll-mt-6">
        <h2 className="mb-3">تغيير كلمة المرور</h2>
        <div className="panel p-5"><PasswordForm /></div>
      </section>

      {user.role === 'owner' && (
        <section id="backup" className="mb-10 scroll-mt-6">
          <h2 className="mb-1">النسخ الاحتياطي</h2>
          <p className="mb-3 text-sm text-muted">نزّل نسخة من بياناتك. السيرفر ياخذ نسخة يومية تلقائياً أيضاً إذا فعّلت سكربت النسخ.</p>
          <div className="panel flex flex-wrap gap-2 p-5">
            {serverAdmin && <a href="/api/backup" className="btn-primary">تنزيل قاعدة البيانات كاملة</a>}
            <a href="/api/export/bookings?view=all" className="btn-ghost">الحجوزات Excel</a>
            <a href="/api/export/guests" className="btn-ghost">الضيوف Excel</a>
            <a href={`/api/export/report?y=${new Date().getFullYear()}`} className="btn-ghost">التقرير السنوي Excel</a>
          </div>
        </section>
      )}
    </div>
  );
}
