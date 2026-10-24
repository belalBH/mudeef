import Link from 'next/link';
import AuthForm from '@/components/AuthForm';
import { signup } from '@/lib/actions';

export const metadata = { title: 'حساب جديد | مُضيف' };

export default function SignupPage() {
  return (
    <>
      <h1>ابدأ بإدارة وحداتك</h1>
      <p className="mb-8 mt-2 text-muted">أنشئ حسابك ثم أضف أول غرفة أو استوديو.</p>
      <AuthForm action={signup} mode="signup" />
      <p className="mt-6 text-sm text-muted">
        عندك حساب؟{' '}
        <Link href="/login" className="font-semibold text-palm underline-offset-4 hover:underline">
          سجّل الدخول
        </Link>
      </p>
    </>
  );
}
