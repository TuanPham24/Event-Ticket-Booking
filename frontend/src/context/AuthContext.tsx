import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, ApiError } from '../lib/api';
import type { User } from '../lib/types';

interface AuthContextValue {
  user: User | null;
  isReady: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, fullName: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // One-time migration: older builds stored the JWT in localStorage under
    // this key. It's now an httpOnly cookie, so scrub the leftover token so it
    // can't linger (and be stolen via XSS) after the upgrade.
    localStorage.removeItem('ctbp.auth');

    // The session lives in an httpOnly cookie the browser sends automatically,
    // so on load we ask the server who (if anyone) it belongs to instead of
    // reading anything out of localStorage.
    api
      .me()
      .then((res) => setUser(res.user))
      .catch((err) => {
        if (!(err instanceof ApiError && err.status === 401)) {
          console.error('Failed to restore session', err);
        }
        setUser(null);
      })
      .finally(() => setIsReady(true));
  }, []);

  async function login(email: string, password: string) {
    const res = await api.login({ email, password });
    setUser(res.user);
  }

  async function register(email: string, password: string, fullName: string) {
    const res = await api.register({ email, password, fullName });
    setUser(res.user);
  }

  async function logout() {
    // Clear local state regardless of whether the network call succeeds, so a
    // failed/expired-session logout still lands the user in a logged-out state.
    try {
      await api.logout();
    } finally {
      setUser(null);
    }
  }

  return (
    <AuthContext.Provider value={{ user, isReady, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
