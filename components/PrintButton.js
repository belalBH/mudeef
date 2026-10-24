'use client';

export default function PrintButton({ label = 'طباعة / حفظ PDF' }) {
  return (
    <button type="button" className="btn-primary print:hidden" onClick={() => window.print()}>
      {label}
    </button>
  );
}
