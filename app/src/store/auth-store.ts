import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User } from '@/types';
import { TOKEN_KEY, USER_KEY } from '@/lib/constants';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isInitialized: boolean;
  setAuth: (user: User, token: string) => void;
  clearAuth: () => void;
  initAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isInitialized: false,

      setAuth: (user, token) => {
        if (typeof window !== 'undefined') {
          localStorage.setItem(TOKEN_KEY, token);
          localStorage.setItem(USER_KEY, JSON.stringify(user));
        }
        set({ user, token, isAuthenticated: true, isInitialized: true });
      },

      clearAuth: () => {
        if (typeof window !== 'undefined') {
          localStorage.removeItem(TOKEN_KEY);
          localStorage.removeItem(USER_KEY);
        }
        set({ user: null, token: null, isAuthenticated: false, isInitialized: true });
      },

      initAuth: () => {
        if (typeof window !== 'undefined') {
          const token = localStorage.getItem(TOKEN_KEY);
          const userStr = localStorage.getItem(USER_KEY);
          if (token && userStr) {
            try {
              const user = JSON.parse(userStr);
              set({ user, token, isAuthenticated: true, isInitialized: true });
            } catch (error) {
              console.error('Failed to parse user data:', error);
              set({ user: null, token: null, isAuthenticated: false, isInitialized: true });
            }
          } else {
            set({ user: null, token: null, isAuthenticated: false, isInitialized: true });
          }
        } else {
          set({ isInitialized: true });
        }
      },
    }),
    {
      name: 'auth-storage',
    }
  )
);
