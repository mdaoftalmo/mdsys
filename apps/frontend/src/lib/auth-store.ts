// apps/frontend/src/lib/auth-store.ts
'use client';

import { create } from 'zustand';
import { api } from './api';
import type { User, AuthResponse } from '@/types';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  checkAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,

  login: async (login: string, password: string) => {
    const res = await api.post<AuthResponse>('/auth/login', { login, password });
    api.setToken(res.access_token);
    set({ user: res.user, isLoading: false });
  },

  logout: () => {
    api.setToken(null);
    set({ user: null, isLoading: false });
    if (typeof window !== 'undefined') window.location.href = '/login';
  },

  checkAuth: async () => {
    try {
      const token = api.getToken();
      if (!token) {
        set({ user: null, isLoading: false });
        return;
      }
      const res = await api.get<{ user: User }>('/auth/me');
      set({ user: res.user, isLoading: false });
    } catch {
      api.setToken(null);
      set({ user: null, isLoading: false });
    }
  },
}));
