import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { authApi } from './authApi.js';
import { readSession, writeSession, clearSession, isRemembered, markTrialEnded, AUTH_EXPIRED_EVENT } from './session.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(() => readSession());
  const [checking, setChecking] = useState(() => !!readSession()?.token);

  // Confirm the stored token is still good (and refresh the account details).
  useEffect(() => {
    const stored = readSession();
    if (!stored?.token) return;
    authApi.me()
      .then(({ account }) => {
        const next = { token: stored.token, account };
        writeSession(isRemembered(), next);
        setSession(next);
      })
      .catch((err) => {
        // Only a rejected token signs the user out; a network blip keeps them in.
        if (err.status === 401) {
          if (err.code === 'trial_expired') markTrialEnded();
          clearSession();
          setSession(null);
        }
      })
      .finally(() => setChecking(false));
  }, []);

  // api.js fires this when any request is answered with 401.
  useEffect(() => {
    const onExpired = () => setSession(null);
    window.addEventListener(AUTH_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, onExpired);
  }, []);

  const login = useCallback(async (email, password, remember = true) => {
    const { token, account } = await authApi.login(email, password, remember);
    const next = { token, account };
    writeSession(remember, next);
    setSession(next);
  }, []);

  // Free trial: no password; the server hands back a session for the temporary account.
  const startTrial = useCallback(async (name, email, attribution) => {
    const { token, account } = await authApi.demoRequest(name, email, attribution);
    const next = { token, account };
    writeSession(true, next);
    setSession(next);
  }, []);

  const logout = useCallback(() => {
    clearSession();
    setSession(null);
  }, []);

  // The trial ends on its own at the stated time: back to the sign-in screen with a note.
  const trialEnd = session?.account?.isDemoTrial ? session.account.demoExpiresAt : null;
  useEffect(() => {
    if (!trialEnd) return undefined;
    const ms = new Date(trialEnd).getTime() - Date.now();
    if (!Number.isFinite(ms)) return undefined;
    const timer = setTimeout(() => { markTrialEnded(); clearSession(); setSession(null); }, Math.min(Math.max(ms, 0), 2 ** 31 - 1));
    return () => clearTimeout(timer);
  }, [trialEnd]);

  // After a password change the server issues a fresh token for this device.
  const replaceSession = useCallback(({ token, account }) => {
    const next = { token, account };
    writeSession(isRemembered(), next);
    setSession(next);
  }, []);

  return (
    <AuthContext.Provider
      value={{ token: session?.token || null, account: session?.account || null, checking, login, startTrial, logout, replaceSession }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
