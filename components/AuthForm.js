'use client';

import { Alert, Submit, useFormAction } from './ui';

export default function AuthForm({ action, mode }) {
  const [state, onSubmit, busy] = useFormAction(action);
  const signup = mode === 'signup';
  const v = state?.values || {};
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {signup && (
        <>
          <div>
            <label className="label" htmlFor="name">اسمك</label>
            <input id="name" name="name" defaultValue={v.name} className="field" autoComplete="name" required />
          </div>
          <div>
            <label className="label" htmlFor="business">اسم النشاط</label>
            <input id="business" name="business" defaultValue={v.business} className="field" placeholder="مثال: استوديوهات الروضة" />
            <p className="hint">اختياري، يظهر في أعلى لوحة التحكم.</p>
          </div>
        </>
      )}
      <div>
        <label className="label" htmlFor="email">البريد الإلكتروني</label>
        <input id="email" name="email" type="email" defaultValue={v.email} dir="ltr" className="field text-start" autoComplete="email" required />
      </div>
      <div>
        <label className="label" htmlFor="password">كلمة المرور</label>
        <input
          id="password"
          name="password"
          type="password"
          dir="ltr"
          className="field text-start"
          autoComplete={signup ? 'new-password' : 'current-password'}
          minLength={signup ? 8 : undefined}
          required
        />
        {signup && <p className="hint">8 أحرف على الأقل.</p>}
      </div>
      <Alert state={state} />
      <Submit busy={busy} className="btn-primary w-full py-2.5" pending={signup ? 'جارٍ إنشاء الحساب…' : 'جارٍ الدخول…'}>
        {signup ? 'إنشاء الحساب' : 'تسجيل الدخول'}
      </Submit>
    </form>
  );
}
