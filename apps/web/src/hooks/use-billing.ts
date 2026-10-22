import { useQuery, useMutation } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';

interface BillingStatus {
  tier: string;
  hasSubscription: boolean;
  subscriptionStatus?: string;
  cancelAtPeriodEnd?: boolean;
}

export function useBillingStatus() {
  return useQuery<BillingStatus>({
    queryKey: ['billing', 'status'],
    queryFn: () => apiClient.get('/billing/status').then((r) => r.data),
  });
}

export function useBillingCheckout() {
  return useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post<{ url: string }>('/billing/checkout', {
        successUrl: `${window.location.origin}/billing/success`,
        cancelUrl: `${window.location.origin}/pricing`,
      });
      return data;
    },
    onSuccess: (data) => {
      if (data.url) window.location.href = data.url;
    },
  });
}

export function useBillingPortal() {
  return useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post<{ url: string }>('/billing/portal', {
        returnUrl: `${window.location.origin}/settings`,
      });
      return data;
    },
    onSuccess: (data) => {
      if (data.url) window.location.href = data.url;
    },
  });
}
