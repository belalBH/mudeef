import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SignJWT, jwtVerify } from 'jose';
import { db } from './db';

const COOKIE = 'mudeef_session';

export const ROLES = {
  owner: 'المالك',
  manager: 'مدير',
  cleaner: 'عامل نظافة وصيانة',
};

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
        `SELECT u.id, u.name, u.email, u.role, u.account_id, u.active, a.name AS account_name, a.slug AS account_slug
         FROM users u JOIN accounts a ON a.id = u.account_id WHERE u.id = ?`
      )
      .get(payload.uid);
    if (!user || !user.active) return null;
    return user;
  } catch {
    return null;
  }
}

// Default: owners and managers. Cleaners only get pages that explicitly allow them.
export async function requireUser(roles = ['owner', 'manager']) {
  const user = await getUser();
  if (!user) redirect('/login');
  if (!roles.includes(user.role)) redirect(user.role === 'cleaner' ? '/tasks' : '/dashboard');
  return user;
}

export function can(user, what) {
  const rules = {
    team: ['owner'],
    backup: ['owner'],
    owners: ['owner', 'manager'],
    money: ['owner', 'manager'],
  };
  return (rules[what] || ['owner', 'manager']).includes(user?.role);
}

export function logActivity(user, action, bookingId = null) {
  try {
    db.prepare('INSERT INTO activity (account_id, user_id, user_name, action, booking_id) VALUES (?,?,?,?,?)').run(
      user.account_id, user.id ?? null, user.name ?? null, action, bookingId
    );
  } catch {
    // activity is best-effort and must never block the real change
  }
}
