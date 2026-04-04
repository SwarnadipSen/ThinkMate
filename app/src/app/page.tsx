'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth-store';
import { ROUTES } from '@/lib/constants';

export default function Home() {
  const router = useRouter();
  const { isAuthenticated, isInitialized, user, initAuth } = useAuthStore();

  useEffect(() => {
    initAuth();
  }, [initAuth]);

  useEffect(() => {
    if (!isInitialized) {
      return;
    }

    if (isAuthenticated && user) {
      if (user.role === 'teacher') {
        router.push(ROUTES.TEACHER_DASHBOARD);
      } else {
        router.push(ROUTES.STUDENT_CHAT);
      }
    } else {
      router.push(ROUTES.LOGIN);
    }
  }, [isAuthenticated, isInitialized, user, router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
    </div>
  );
}
