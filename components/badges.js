import { STATUSES, sourceColor, sourceLabel } from '@/lib/constants';

export function SourceTag({ source }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-sm">
      <span className="h-2.5 w-2.5 rounded-full" style={{ background: sourceColor(source) }} aria-hidden />
      {sourceLabel(source)}
    </span>
  );
}

export function StatusTag({ booking }) {
  if (booking.status === 'pending')
    return <span className="rounded bg-saffron-soft px-2 py-0.5 text-xs font-semibold">طلب جديد</span>;
  if (booking.status === 'cancelled')
    return <span className="rounded bg-line/60 px-2 py-0.5 text-xs text-muted">{STATUSES.cancelled}</span>;
  if (booking.conflict)
    return <span className="rounded bg-danger-soft px-2 py-0.5 text-xs font-semibold text-danger">تعارض</span>;
  return <span className="rounded bg-palm-soft px-2 py-0.5 text-xs text-palm-dark">{STATUSES.confirmed}</span>;
}
