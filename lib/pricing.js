// Shared by the server and the booking form: nightly price for a unit on a given date.
// Order: a season set for this unit, then a season for all units, then the unit's own prices.

function isWeekendNight(iso) {
  const d = new Date(iso + 'T00:00:00Z').getUTCDay();
  return d === 4 || d === 5;
}

function addDay(iso) {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export function seasonFor(unitId, date, rates = []) {
  const hit = (r) => r.start_on <= date && r.end_on >= date;
  return rates.find((r) => r.unit_id === unitId && hit(r)) || rates.find((r) => r.unit_id == null && hit(r)) || null;
}

export function nightPrice(unit, date, rates = []) {
  const weekend = isWeekendNight(date);
  const s = seasonFor(unit.id, date, rates);
  if (s) return weekend && s.weekend_price ? s.weekend_price : s.price;
  return weekend && unit.weekend_price ? unit.weekend_price : unit.base_price;
}

export function quote(unit, checkIn, checkOut, rates = []) {
  if (!unit || !checkIn || !checkOut || checkOut <= checkIn) return { total: 0, nights: [], seasons: [], minNights: 1 };
  const nights = [];
  const seasons = new Set();
  let minNights = 1;
  for (let d = checkIn; d < checkOut; d = addDay(d)) {
    const s = seasonFor(unit.id, d, rates);
    if (s) {
      seasons.add(s.name);
      minNights = Math.max(minNights, s.min_nights || 1);
    }
    nights.push({ date: d, price: nightPrice(unit, d, rates) });
  }
  return { total: nights.reduce((a, n) => a + n.price, 0), nights, seasons: [...seasons], minNights };
}
