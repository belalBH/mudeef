import { notFound } from 'next/navigation';
import { publicAccount, publicUnits, unitPhotos } from '@/lib/queries-v3';
import { findOverlaps, seasonRates } from '@/lib/bookings';
import { quote } from '@/lib/pricing';
import { addDays, diffDays, nightsLabel, prettyDate, todayISO } from '@/lib/dates';
import { UNIT_TYPES, money } from '@/lib/constants';
import { RequestForm } from '@/components/forms-v3';
import Logo from '@/components/Logo';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const acc = publicAccount(slug);
  return { title: acc ? `احجز في ${acc.name}` : 'صفحة غير موجودة', robots: { index: true } };
}

export default async function PublicBooking({ params, searchParams }) {
  const { slug } = await params;
  const sp = await searchParams;
  const acc = publicAccount(slug);
  if (!acc) notFound();
  const today = todayISO();
  const units = publicUnits(acc.id);
  const rates = seasonRates(acc.id);
  const ci = /^\d{4}-\d{2}-\d{2}$/.test(sp.in || '') && sp.in >= today ? sp.in : '';
  const co = /^\d{4}-\d{2}-\d{2}$/.test(sp.out || '') && sp.out > ci ? sp.out : '';
  const guests = Math.max(1, Math.min(30, Number(sp.guests) || 1));
  const searched = ci && co;
  const nights = searched ? diffDays(ci, co) : 0;

  const cards = units.map((u) => {
    const photos = unitPhotos(u.id);
    let status = null;
    let q = null;
    if (searched) {
      q = quote(u, ci, co, rates);
      if (u.capacity < guests) status = 'capacity';
      else if (findOverlaps(u.id, ci, co).length) status = 'booked';
      else if (nights < q.minNights) status = 'min';
      else status = 'ok';
    }
    return { u, photos, status, q };
  });
  const sorted = searched ? [...cards].sort((a, b) => (a.status === 'ok' ? 0 : 1) - (b.status === 'ok' ? 0 : 1)) : cards;
  const available = cards.filter((c) => c.status === 'ok').length;

  return (
    <div className="min-h-screen bg-paper">
      <header className="bg-palm-dark text-white">
        <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
          <h1 className="text-3xl">{acc.name}</h1>
          {acc.booking_intro && <p className="mt-2 max-w-2xl whitespace-pre-line text-white/80">{acc.booking_intro}</p>}
          <form className="mt-6 grid gap-3 rounded-lg bg-white p-4 text-ink sm:grid-cols-[1fr_1fr_7rem_auto] sm:items-end" action={`/book/${slug}`}>
            <div>
              <label className="label" htmlFor="in">الوصول</label>
              <input id="in" name="in" type="date" min={today} defaultValue={ci} className="field" required />
            </div>
            <div>
              <label className="label" htmlFor="out">المغادرة</label>
              <input id="out" name="out" type="date" min={addDays(today, 1)} defaultValue={co} className="field" required />
            </div>
            <div>
              <label className="label" htmlFor="guests">الضيوف</label>
              <input id="guests" name="guests" type="number" min="1" max="30" defaultValue={guests} className="field" />
            </div>
            <button className="btn-primary py-2.5">عرض المتاح</button>
          </form>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        {searched && (
          <p className="mb-6 text-lg">
            {available ? `${available} من ${units.length} متاحة` : 'لا توجد وحدات متاحة'} من {prettyDate(ci)} إلى {prettyDate(co)}، {nightsLabel(nights)}
          </p>
        )}
        {units.length === 0 && <p className="text-muted">لا توجد وحدات معروضة حالياً.</p>}

        <div className="space-y-6">
          {sorted.map(({ u, photos, status, q }) => (
            <article key={u.id} className={`panel overflow-hidden ${status && status !== 'ok' ? 'opacity-60' : ''}`}>
              <div className="grid md:grid-cols-[minmax(0,1.1fr)_1fr]">
                <div className="bg-line">
                  {photos.length ? (
                    <>
                      <img src={`/api/files/${photos[0].file}`} alt={u.name} className="aspect-[4/3] w-full object-cover" />
                      {photos.length > 1 && (
                        <div className="flex gap-1 overflow-x-auto p-1">
                          {photos.slice(1, 8).map((p) => (
                            <a key={p.id} href={`/api/files/${p.file}`} target="_blank" rel="noreferrer">
                              <img src={`/api/files/${p.file}`} alt="" className="h-14 w-20 shrink-0 rounded object-cover" />
                            </a>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="grid h-24 place-items-center text-muted md:h-full md:min-h-40">{UNIT_TYPES[u.type]}</div>
                  )}
                </div>
                <div className="flex flex-col p-5">
                  <h2 className="text-xl">{u.name}</h2>
                  <p className="text-sm text-muted">
                    {UNIT_TYPES[u.type]}{u.city ? `، ${u.city}` : ''}، حتى {u.capacity} ضيوف{u.bedrooms ? `، ${u.bedrooms} غرف نوم` : ''}
                  </p>
                  {u.description && <p className="mt-3 whitespace-pre-line text-sm leading-relaxed">{u.description}</p>}
                  {u.amenities && (
                    <ul className="mt-3 flex flex-wrap gap-1.5">
                      {u.amenities.split(/[،,]/).map((a) => a.trim()).filter(Boolean).map((a) => (
                        <li key={a} className="rounded-full bg-paper px-2.5 py-0.5 text-xs ring-1 ring-line">{a}</li>
                      ))}
                    </ul>
                  )}
                  {u.house_rules && <p className="mt-3 text-xs text-muted">القوانين: {u.house_rules}</p>}
                  <div className="mt-auto pt-4">
                    {!searched && (
                      <p>
                        <span className="text-2xl font-bold">{money(u.base_price)}</span> <span className="text-sm text-muted">لليلة</span>
                        {u.weekend_price && u.weekend_price !== u.base_price && (
                          <span className="block text-xs text-muted">الخميس والجمعة {money(u.weekend_price)}</span>
                        )}
                      </p>
                    )}
                    {status === 'booked' && <p className="font-semibold text-danger">محجوزة في هذه التواريخ</p>}
                    {status === 'capacity' && <p className="font-semibold text-danger">لا تتسع لـ {guests} ضيوف</p>}
                    {status === 'min' && <p className="font-semibold text-saffron">أقل مدة حجز في هذه الفترة {q.minNights} ليالٍ</p>}
                    {status === 'ok' && (
                      <>
                        <p>
                          <span className="text-2xl font-bold">{money(q.total)}</span>{' '}
                          <span className="text-sm text-muted">الإجمالي لـ {nightsLabel(nights)}</span>
                        </p>
                        <details className="mt-3" open={sorted.length === 1}>
                          <summary className="btn-primary cursor-pointer list-none">احجز هذه الوحدة</summary>
                          <div className="mt-4">
                            <RequestForm slug={slug} unit={u.id} checkIn={ci} checkOut={co} guests={guests} />
                          </div>
                        </details>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      </main>

      <footer className="mx-auto max-w-5xl px-4 pb-10 pt-4 text-sm text-muted sm:px-6">
        {acc.phone && (
          <p>
            للاستفسار:{' '}
            <a href={`https://wa.me/${acc.phone.replace(/\D/g, '').replace(/^0/, '966')}`} className="text-palm underline" target="_blank" rel="noreferrer">
              واتساب {acc.phone}
            </a>
          </p>
        )}
        <div className="mt-6 opacity-70"><Logo /></div>
      </footer>
    </div>
  );
}
