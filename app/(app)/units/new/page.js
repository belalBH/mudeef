import Link from 'next/link';
import UnitForm from '@/components/UnitForm';

export const metadata = { title: 'وحدة جديدة | مُضيف' };

export default async function NewUnitPage({ searchParams }) {
  const { welcome } = await searchParams;
  return (
    <div className="max-w-2xl">
      <Link href="/units" className="text-sm text-muted hover:text-palm">الوحدات</Link>
      <h1 className="mt-1">{welcome ? 'تم إنشاء حسابك. أضف أول وحدة' : 'وحدة جديدة'}</h1>
      <p className="mb-6 mt-1 text-muted">بعد الحفظ تقدر تربطها مع Airbnb وBooking.com وجاذر إن.</p>
      <div className="panel p-5 sm:p-6">
        <UnitForm />
      </div>
    </div>
  );
}
