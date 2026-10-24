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

// Owner-closed dates (maintenance, personal use) are stored as bookings with this source
export const BLOCK = { label: 'مغلق', color: '#9AA39F' };

export const STAY_STATUSES = {
  upcoming: 'لم يصل',
  checked_in: 'مقيم',
  checked_out: 'غادر',
  no_show: 'لم يحضر',
};

export const PAYMENT_METHODS = {
  cash: 'نقداً',
  mada: 'مدى / بطاقة',
  transfer: 'تحويل بنكي',
  stc_pay: 'STC Pay',
  platform: 'عن طريق المنصة',
  other: 'أخرى',
};

export const EXPENSE_CATEGORIES = {
  cleaning: 'تنظيف',
  laundry: 'غسيل ومفارش',
  maintenance: 'صيانة',
  utilities: 'كهرباء وماء وإنترنت',
  supplies: 'مستلزمات وضيافة',
  rent: 'إيجار',
  salaries: 'رواتب',
  marketing: 'تسويق',
  fees: 'رسوم وتراخيص',
  other: 'أخرى',
};

export const TASK_TYPES = {
  cleaning: 'تنظيف',
  maintenance: 'صيانة',
  inspection: 'فحص',
  other: 'مهمة',
};

export const WA_DEFAULTS = {
  wa_confirm:
    'أهلاً {الضيف}،\nتم تأكيد حجزك في {الوحدة} من {الدخول} إلى {الخروج} ({الليالي}).\nالإجمالي: {الإجمالي}، المتبقي: {المتبقي}.\nنتشرف بزيارتك.',
  wa_checkin:
    'أهلاً {الضيف}،\nموعد الدخول اليوم من الساعة {وقت_الدخول}.\n{تعليمات_الدخول}\nلأي استفسار راسلنا هنا.',
  wa_thanks: 'شكراً {الضيف} على إقامتك في {الوحدة}، نتمنى نشوفك مرة ثانية.\nيسعدنا تقييمك للإقامة.',
};

export function isBlock(b) {
  return b?.source === 'block';
}

export function sourceLabel(s) {
  if (s === 'block') return BLOCK.label;
  return SOURCES[s]?.label || s;
}

export function sourceColor(s) {
  if (s === 'block') return BLOCK.color;
  return SOURCES[s]?.color || SOURCES.other.color;
}

export function money(n) {
  const v = Number(n || 0);
  return v.toLocaleString('en-US', { maximumFractionDigits: 0 }) + ' ر.س';
}

export function num(n) {
  return Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 0 });
}
