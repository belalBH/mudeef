import { getUser } from '@/lib/auth';
import { listBookings, listExpenses, listGuests, yearReport } from '@/lib/queries';
import { EXPENSE_CATEGORIES, SOURCES, STAY_STATUSES, sourceLabel } from '@/lib/constants';
import { diffDays, monthShort, todayISO } from '@/lib/dates';

export const dynamic = 'force-dynamic';

function csv(rows) {
  const cell = (v) => {
    const s = v == null ? '' : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  // BOM so Excel opens Arabic text correctly
  return '﻿' + rows.map((r) => r.map(cell).join(',')).join('\r\n');
}

const r2 = (n) => Math.round((n || 0) * 100) / 100;

export async function GET(req, { params }) {
  const user = await getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });
  const { kind } = await params;
  const sp = new URL(req.url).searchParams;
  let rows;
  let name;

  if (kind === 'bookings') {
    const list = listBookings(user.account_id, {
      view: sp.get('view') || 'all',
      unit: Number(sp.get('unit')) || null,
      source: SOURCES[sp.get('source')] ? sp.get('source') : null,
      q: sp.get('q') || '',
    });
    rows = [
      ['رقم', 'الضيف', 'الجوال', 'الوحدة', 'الدخول', 'الخروج', 'الليالي', 'المصدر', 'الإجمالي', 'العمولة', 'الصافي', 'المدفوع', 'المتبقي', 'الحالة', 'حالة الإقامة', 'ملاحظات'],
      ...list.map((b) => [
        b.id, b.guest_name, b.guest_phone, b.unit_name, b.check_in, b.check_out, diffDays(b.check_in, b.check_out),
        sourceLabel(b.source), r2(b.total_amount), r2(b.commission), r2(b.total_amount - b.commission), r2(b.paid_amount),
        r2(b.total_amount - b.paid_amount), b.status === 'cancelled' ? 'ملغي' : 'مؤكد', STAY_STATUSES[b.stay_status], b.notes,
      ]),
    ];
    name = `bookings-${todayISO()}`;
  } else if (kind === 'expenses') {
    const ym = /^\d{4}-\d{2}$/.test(sp.get('m') || '') ? sp.get('m') : todayISO().slice(0, 7);
    rows = [
      ['التاريخ', 'البند', 'الوحدة', 'المبلغ', 'ملاحظة'],
      ...listExpenses(user.account_id, ym).map((e) => [e.spent_on, EXPENSE_CATEGORIES[e.category], e.unit_name || 'عام', r2(e.amount), e.note]),
    ];
    name = `expenses-${ym}`;
  } else if (kind === 'guests') {
    rows = [
      ['الاسم', 'الجوال', 'البريد', 'الجنسية', 'الإقامات', 'الإجمالي', 'آخر إقامة', 'محظور', 'ملاحظات'],
      ...listGuests(user.account_id).map((g) => [g.name, g.phone, g.email, g.nationality, g.stays, r2(g.spent), g.last_stay, g.blacklisted ? 'نعم' : '', g.notes]),
    ];
    name = `guests-${todayISO()}`;
  } else if (kind === 'report') {
    const y = Number(sp.get('y')) || Number(todayISO().slice(0, 4));
    const r = yearReport(user.account_id, y);
    rows = [
      ['الشهر', 'صافي الإيرادات', 'المصاريف', 'الربح', 'الليالي', 'الإشغال %', 'حجوزات جديدة'],
      ...r.months.map((m) => [monthShort(m.m), r2(m.revenue), r2(m.expenses), r2(m.profit), m.nights, Math.round(m.occupancy * 100), m.bookings]),
      ['المجموع', r2(r.totals.revenue), r2(r.totals.expenses), r2(r.totals.profit), r.totals.nights, Math.round(r.totals.occupancy * 100), ''],
      [],
      ['الوحدة', 'الإيراد', 'المصاريف', 'الربح', 'الليالي', 'الإشغال %'],
      ...r.byUnit.map((u) => [u.name, r2(u.revenue), r2(u.expenses), r2(u.profit), u.nights, Math.round(u.occupancy * 100)]),
    ];
    name = `report-${y}`;
  } else {
    return new Response('Not found', { status: 404 });
  }

  return new Response(csv(rows), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${name}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
