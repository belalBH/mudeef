import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { listGuests, listUnits } from '@/lib/queries';
import { seasonRates } from '@/lib/bookings';
import BookingForm from '@/components/BookingForm';

export const metadata = { title: 'حجز جديد | مُضيف' };

export default async function NewBookingPage({ searchParams }) {
  const user = await requireUser();
  const sp = await searchParams;
  const units = listUnits(user.account_id, { activeOnly: true });
  const block = sp.block === '1';
  const guestsList = listGuests(user.account_id);
  const preGuest = sp.guest ? guestsList.find((g) => String(g.id) === sp.guest) : null;
  return (
    <div className="max-w-2xl">
      <Link href={block ? '/calendar' : '/bookings'} className="text-sm text-muted hover:text-palm">
        {block ? 'التقويم' : 'الحجوزات'}
      </Link>
      <h1 className="mt-1">{block ? 'إغلاق تواريخ' : 'حجز جديد'}</h1>
      <p className="mb-6 mt-1 text-muted">
        {block
          ? 'التواريخ المغلقة تظهر محجوزة في كل المنصات المربوطة، مناسبة للصيانة أو الاستخدام الشخصي.'
          : 'للحجوزات المباشرة أو أي حجز تبي تسجله يدوياً.'}
      </p>
      {units.length === 0 ? (
        <div className="panel p-6">
          <p>أضف وحدة أولاً حتى تقدر تسجل عليها حجوزات.</p>
          <Link href="/units/new" className="btn-primary mt-4">إضافة وحدة</Link>
        </div>
      ) : (
        <div className="panel p-5 sm:p-6">
          <BookingForm
            units={units}
            rates={seasonRates(user.account_id)}
            guests={guestsList}
            booking={preGuest ? { guest_name: preGuest.name, guest_phone: preGuest.phone } : undefined}
            defaults={{ unit: sp.unit, check_in: sp.from, check_out: sp.to, source: block ? 'block' : undefined }}
          />
        </div>
      )}
    </div>
  );
}
