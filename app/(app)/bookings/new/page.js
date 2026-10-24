import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { listUnits } from '@/lib/queries';
import BookingForm from '@/components/BookingForm';

export const metadata = { title: 'حجز جديد | مُضيف' };

export default async function NewBookingPage({ searchParams }) {
  const user = await requireUser();
  const sp = await searchParams;
  const units = listUnits(user.account_id, { activeOnly: true });
  return (
    <div className="max-w-2xl">
      <Link href="/bookings" className="text-sm text-muted hover:text-palm">الحجوزات</Link>
      <h1 className="mb-6 mt-1">حجز جديد</h1>
      {units.length === 0 ? (
        <div className="panel p-6">
          <p>أضف وحدة أولاً حتى تقدر تسجل عليها حجوزات.</p>
          <Link href="/units/new" className="btn-primary mt-4">إضافة وحدة</Link>
        </div>
      ) : (
        <div className="panel p-5 sm:p-6">
          <BookingForm units={units} defaults={{ unit: sp.unit, check_in: sp.from, check_out: sp.to }} />
        </div>
      )}
    </div>
  );
}
