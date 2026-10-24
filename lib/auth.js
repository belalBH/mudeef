import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SignJWT, jwtVerify } from 'jose';
import { db } from './db';

const COOKIE = 'mudeef_session';

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s && process.env.NODE_ENV === 'production') {
    throw new Error('SESSION_SECRET is not set');
  }
  return new TextEncoder().encode(s || 'dev-only-secret-change-me');
}

export async function createSession(user) {
  const token = await new SignJWT({ uid: user.id, aid: user.account_id })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(secret());
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.COOKIE_SECURE === 'true',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function destroySession() {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export async function getUser() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    const user = db
      .prepare(
        `SELECT u.id, u.name, u.email, u.role, u.account_id, a.name AS account_name
         FROM users u JOIN accounts a ON a.id = u.account_id WHERE u.id = ?`
      )
      .get(payload.uid);
    return user || null;
  } catch {
    return null;
  }
}

export async function requireUser() {
  const user = await getUser();
  if (!user) redirect('/login');
  return user;
}
