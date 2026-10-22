// Where the sign-in token lives. "Remember me" -> localStorage (survives
// closing the browser); otherwise sessionStorage (gone with the tab).
// Imported by api.js, so it must not import anything from the app.
import { BRAND } from './brand.jsx';

export const AUTH_EXPIRED_EVENT = 'crm-auth-expired';

function read(storage) {
  try {
    const raw = storage.getItem(BRAND.storageKey);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function readSession() {
  try {
    return read(localStorage) || read(sessionStorage);
  } catch {
    return null;
  }
}

export function isRemembered() {
  try {
    return !!localStorage.getItem(BRAND.storageKey);
  } catch {
    return true;
  }
}

export function writeSession(remember, value) {
  clearSession();
  try {
    (remember ? localStorage : sessionStorage).setItem(BRAND.storageKey, JSON.stringify(value));
  } catch {
    // storage blocked: the session just lasts until the page is closed
  }
}

export function clearSession() {
  try { localStorage.removeItem(BRAND.storageKey); } catch { /* ignore */ }
  try { sessionStorage.removeItem(BRAND.storageKey); } catch { /* ignore */ }
}

export function getToken() {
  return readSession()?.token || null;
}

export function authHeaders() {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// "The free trial ended" note on the sign-in screen: set when the server (or the countdown) ends a trial session.
const TRIAL_ENDED_KEY = 'anvil-trial-ended';
export function markTrialEnded() {
  try { sessionStorage.setItem(TRIAL_ENDED_KEY, '1'); } catch { /* storage blocked */ }
}
// Read without clearing: the page can reload by itself (a new service worker taking over) and the note must survive that.
export function peekTrialEnded() {
  try { return sessionStorage.getItem(TRIAL_ENDED_KEY) === '1'; } catch { return false; }
}
export function consumeTrialEnded() {
  try {
    const v = sessionStorage.getItem(TRIAL_ENDED_KEY) === '1';
    sessionStorage.removeItem(TRIAL_ENDED_KEY);
    return v;
  } catch {
    return false;
  }
}

// Called by api.js when any request comes back 401 while holding a token.
export function handleUnauthorized(code) {
  if (!getToken()) return;
  if (code === 'trial_expired') markTrialEnded();
  clearSession();
  window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
}
