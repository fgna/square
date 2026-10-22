'use client';

import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import { useAuthStore } from '@/store/auth.store';

export function useProfileSync() {
  const { user, updateUser } = useAuthStore();
  const { data: profile } = useQuery({
    queryKey: ['me'],
    queryFn: () => apiClient.get('/users/me').then((r) => r.data),
    staleTime: 60_000,
    enabled: !!user,
  });

  useEffect(() => {
    if (!profile || !user) return;
    const needsUpdate =
      profile.avatarUrl !== user.avatarUrl ||
      profile.name !== user.name ||
      profile.role !== user.role;
    if (needsUpdate) {
      updateUser({
        name: profile.name,
        avatarUrl: profile.avatarUrl,
        role: profile.role,
      });
    }
  }, [profile, user, updateUser]);
}
