import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="grid min-h-[60vh] place-items-center px-6 text-center">
      <div>
        <h1>الصفحة غير موجودة</h1>
        <p className="mt-2 text-muted">ربما حُذف هذا العنصر أو تغيّر رابطه.</p>
        <Link href="/dashboard" className="btn-primary mt-6">العودة للرئيسية</Link>
      </div>
    </main>
  );
}
