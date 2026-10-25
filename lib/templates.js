import { WA_DEFAULTS } from './constants';
import { diffDays, nightsLabel, prettyDate } from './dates';

const fmt = (n) => Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 0 }) + ' ر.س';

export function fillTemplate(tpl, booking, account, extra = {}) {
  const vars = {
    'الضيف': booking.guest_name || 'ضيفنا العزيز',
    'الوحدة': booking.unit_name || '',
    'الدخول': prettyDate(booking.check_in),
    'الخروج': prettyDate(booking.check_out),
    'الليالي': nightsLabel(diffDays(booking.check_in, booking.check_out)),
    'الإجمالي': fmt(booking.total_amount),
    'المتبقي': fmt(Math.max(0, booking.total_amount - booking.paid_amount)),
    'وقت_الدخول': account?.checkin_time || '15:00',
    'وقت_الخروج': account?.checkout_time || '12:00',
    'تعليمات_الدخول': booking.checkin_info || '',
    'النشاط': account?.name || '',
    'رابط_الضيف': extra.guestLink || '',
    'الموقع': booking.map_url || '',
    'الواي_فاي': booking.wifi_name ? `${booking.wifi_name}${booking.wifi_password ? ' / ' + booking.wifi_password : ''}` : '',
  };
  return tpl.replace(/\{([^{}]+)\}/g, (m, k) => (k in vars ? vars[k] : m)).replace(/\n{3,}/g, '\n\n').trim();
}

export function templatesFor(account) {
  return {
    confirm: { label: 'تأكيد الحجز', text: account?.wa_confirm || WA_DEFAULTS.wa_confirm },
    checkin: { label: 'تعليمات الدخول', text: account?.wa_checkin || WA_DEFAULTS.wa_checkin },
    thanks: { label: 'شكر بعد الخروج', text: account?.wa_thanks || WA_DEFAULTS.wa_thanks },
  };
}

export function waLink(phone, text) {
  const digits = String(phone || '').replace(/\D/g, '').replace(/^0/, '966');
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

export const TEMPLATE_VARS = ['الضيف', 'الوحدة', 'الدخول', 'الخروج', 'الليالي', 'الإجمالي', 'المتبقي', 'وقت_الدخول', 'وقت_الخروج', 'تعليمات_الدخول', 'الواي_فاي', 'الموقع', 'رابط_الضيف', 'النشاط'];
