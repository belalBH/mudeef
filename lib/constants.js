export const SOURCES = {
  direct: { label: 'مباشر', color: '#1F5C45' },
  airbnb: { label: 'Airbnb', color: '#D9555B' },
  booking: { label: 'Booking.com', color: '#2A5BA8' },
  gathern: { label: 'جاذر إن', color: '#6B4BB4' },
  other: { label: 'أخرى', color: '#7A7F7C' },
};

// Platforms that can be linked through an iCal calendar link
export const CHANNEL_SOURCES = ['airbnb', 'booking', 'gathern', 'other'];

export const UNIT_TYPES = {
  room: 'غرفة',
  studio: 'استوديو',
  apartment: 'شقة',
  chalet: 'شاليه',
  villa: 'فيلا',
};

export const STATUSES = {
  confirmed: 'مؤكد',
  cancelled: 'ملغي',
};

export function sourceLabel(s) {
  return SOURCES[s]?.label || s;
}

export function money(n) {
  const v = Number(n || 0);
  return v.toLocaleString('en-US', { maximumFractionDigits: 0 }) + ' ر.س';
}

export function num(n) {
  return Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 0 });
}
