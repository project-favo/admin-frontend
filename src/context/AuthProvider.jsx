import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { firebaseAuth } from '../config/firebase';
import { adminLogin } from '../api/authApi';
import { AuthContext } from './authContext';

function loginRejectedMessage(status) {
  switch (status) {
    case 401:
      return 'Session rejected (401). Try signing in again.';
    case 404:
      return 'User not found on the backend (404).';
    case 500:
      return 'Server error (500).';
    case 502:
      return 'Bad gateway (502).';
    case 503:
      return 'Service unavailable (503).';
    default:
      return `Sign-in failed (HTTP ${status}).`;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    if (!firebaseAuth) {
      setLoading(false);
      return undefined;
    }
    const unsub = onAuthStateChanged(firebaseAuth, async (fbUser) => {
      setLoading(true);
      if (!fbUser) {
        setUser(null);
        setLoading(false);
        return;
      }
      try {
        const token = await fbUser.getIdToken();
        const res = await adminLogin(token);
        if (!res.ok) {
          let errText = '';
          try {
            errText = await res.text();
          } catch {
            /* ignore */
          }
          if (import.meta.env.DEV) {
            console.error(
              '[auth] POST /api/auth/login/admin',
              res.status,
              errText?.slice(0, 1200) || '(empty)'
            );
          }
          await signOut(firebaseAuth);
          setUser(null);
          if (res.status === 403) {
            setAuthError('This account does not have admin access.');
          } else {
            setAuthError(loginRejectedMessage(res.status));
          }
          return;
        }
        setAuthError(null);
        let dto;
        try {
          dto = await res.json();
        } catch {
          await signOut(firebaseAuth);
          setUser(null);
          setAuthError('Invalid response from server.');
          return;
        }
        setUser(dto);
      } catch (err) {
        if (import.meta.env.DEV) console.error('[auth]', err);
        await signOut(firebaseAuth);
        setUser(null);
        setAuthError('Connection error. Check the network and API URL.');
      } finally {
        setLoading(false);
      }
    });
    return () => unsub();
  }, []);

  const login = useCallback(async (email, password) => {
    if (!firebaseAuth) throw new Error('Firebase is not configured.');
    setAuthError(null);
    await signInWithEmailAndPassword(firebaseAuth, email.trim(), password);
  }, []);

  const logout = useCallback(async () => {
    if (!firebaseAuth) return;
    setAuthError(null);
    await signOut(firebaseAuth);
  }, []);

  const clearAuthError = useCallback(() => setAuthError(null), []);

  const value = useMemo(
    () => ({
      user,
      loading,
      authError,
      login,
      logout,
      clearAuthError,
    }),
    [user, loading, authError, login, logout, clearAuthError]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
