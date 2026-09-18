import { adminLogin, setAuthTokenGetter } from '@workspace/api-client-react';

const KEY = 'rsvp-admin-token';
let memoryToken: string | null = null;

// Only the server-issued token is kept in the browser; the password itself is never stored.
export function getAdminToken(): string | null {
  try {
    const token = sessionStorage.getItem(KEY);
    if (!token) return null;
    const expiry = Number(token.split('.')[0]);
    if (!expiry || expiry < Date.now()) {
      sessionStorage.removeItem(KEY);
      return null;
    }
    return token;
  } catch {
    return null;
  }
}

export function clearAdminToken() {
  memoryToken = null;
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // storage unavailable; nothing to clear
  }
}

export async function signIn(password: string) {
  const session = await adminLogin({ password });
  try {
    sessionStorage.setItem(KEY, session.token);
  } catch {
    // storage unavailable: the admin will be asked again on reload
  }
  memoryToken = session.token;
}

setAuthTokenGetter(() => getAdminToken() ?? memoryToken);

export function hasAdminSession() {
  return (getAdminToken() ?? memoryToken) !== null;
}
