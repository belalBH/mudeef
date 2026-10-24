'use client';

import { useFormStatus } from 'react-dom';
import { startTransition, useActionState, useState } from 'react';

export function Submit({ children, pending: pendingText = 'جارٍ الحفظ…', className = 'btn-primary', busy }) {
  const status = useFormStatus();
  const pending = busy ?? status.pending;
  return (
    <button type="submit" className={className} disabled={pending}>
      {pending ? pendingText : children}
    </button>
  );
}

// Submits through the action without React's automatic form reset, so typed values survive a validation error
export function useFormAction(action) {
  const [state, dispatch, busy] = useActionState(action, null);
  const onSubmit = (e) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget, e.nativeEvent.submitter);
    startTransition(() => dispatch(fd));
  };
  return [state, onSubmit, busy];
}

export function Alert({ state }) {
  if (!state) return null;
  if (state.error)
    return (
      <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
        {state.error}
      </p>
    );
  if (state.message)
    return (
      <p role="status" className="rounded-md bg-palm-soft px-3 py-2 text-sm text-palm-dark">
        {state.message}
      </p>
    );
  return null;
}

export function CopyField({ value, label }) {
  const [copied, setCopied] = useState(false);
  return (
    <div>
      {label && <span className="label">{label}</span>}
      <div className="flex gap-2">
        <input readOnly value={value} dir="ltr" className="field font-mono text-xs" onFocus={(e) => e.target.select()} />
        <button
          type="button"
          className="btn-ghost shrink-0"
          onClick={async () => {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
          }}
        >
          {copied ? 'تم النسخ' : 'نسخ'}
        </button>
      </div>
    </div>
  );
}

export function ConfirmButton({ children, message, className = 'btn-danger' }) {
  return (
    <button
      type="submit"
      className={className}
      onClick={(e) => {
        if (!confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
