'use client';

import { useEffect } from 'react';

// Brings today's column into view when the calendar opens on the current month
export default function ScrollToToday({ targetId }) {
  useEffect(() => {
    const el = document.getElementById(targetId);
    el?.scrollIntoView({ block: 'nearest', inline: 'center' });
    window.scrollTo({ top: 0 });
  }, [targetId]);
  return null;
}
