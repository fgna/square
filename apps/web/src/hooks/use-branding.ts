import { useQuery } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';

export interface Branding {
  platformName: string;
  logoUrl: string | null;
  /** Admin → Settings: without it, registration needs an invitation. */
  allowSignups: boolean;
}

/** Name, logo and sign-up setting from Admin → Settings (public: also used before sign-in). */
export function useBranding() {
  return useQuery<Branding>({
    queryKey: ['branding'],
    queryFn: () => apiClient.get('/platform/branding').then((r) => r.data),
    staleTime: 5 * 60 * 1000,
  });
}
