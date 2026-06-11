import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AuthSession } from '../types/gas';

interface AuthStore {
  session: AuthSession | null;
  setSession: (s: AuthSession) => void;
  clear: () => void;
  isAuthenticated: () => boolean;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      session: null,

      setSession: (session) => {
        localStorage.setItem('gas_token', session.token);
        set({ session });
      },

      clear: () => {
        localStorage.removeItem('gas_token');
        set({ session: null });
      },

      isAuthenticated: () => {
        const s = get().session;
        if (!s) return false;
        return Date.now() < new Date(s.expiresAt).getTime();
      },
    }),
    { name: 'qlcl_auth_v1' }
  )
);
