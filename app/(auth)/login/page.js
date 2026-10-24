import Link from 'next/link';
import AuthForm from '@/components/AuthForm';
import { login } from '@/lib/actions';

export const metadata = { title: 'تسجيل الدخول | مُضيف' };

export default function LoginPage() {
  return (
    <>
      <h1>أهلاً بعودتك</h1>
      <p className="mb-8 mt-2 text-muted">سجّل الدخول لمتابعة حجوزاتك.</p>
      <AuthForm action={login} mode="login" />
      <p className="mt-6 text-sm text-muted">
        ما عندك حساب؟{' '}
        <Link href="/signup" className="font-semibold text-palm underline-offset-4 hover:underline">
          أنشئ حساباً جديداً
        </Link>
      </p>
    </>
  );
}
