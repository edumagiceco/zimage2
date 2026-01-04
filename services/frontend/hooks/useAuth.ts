'use client';

import { useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { getCurrentUser, logout as apiLogout, refreshToken } from '@/lib/api';

export function useAuth() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading, setUser, setLoading, logout: storeLogout } = useAuthStore();

  // Initialize auth state on mount
  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('access_token');

      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const userData = await getCurrentUser();
        setUser(userData);
      } catch (error: any) {
        // If token expired, try to refresh
        if (error.response?.status === 401) {
          try {
            const newTokens = await refreshToken();
            localStorage.setItem('access_token', newTokens.access_token);
            localStorage.setItem('refresh_token', newTokens.refresh_token);
            const userData = await getCurrentUser();
            setUser(userData);
          } catch {
            // Refresh failed, clear auth state
            localStorage.removeItem('access_token');
            localStorage.removeItem('refresh_token');
            storeLogout();
          }
        } else {
          storeLogout();
        }
      }
    };

    initAuth();
  }, [setUser, setLoading, storeLogout]);

  const logout = useCallback(async () => {
    try {
      await apiLogout();
    } finally {
      storeLogout();
      router.push('/');
    }
  }, [storeLogout, router]);

  const requireAuth = useCallback(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/auth/login');
      return false;
    }
    return true;
  }, [isLoading, isAuthenticated, router]);

  return {
    user,
    isAuthenticated,
    isLoading,
    logout,
    requireAuth,
  };
}

// Hook for protected pages
export function useRequireAuth() {
  const { isAuthenticated, isLoading } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/auth/login');
    }
  }, [isLoading, isAuthenticated, router]);

  return { isAuthenticated, isLoading };
}
