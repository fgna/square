import { QueryClient, MutationCache, QueryCache } from '@tanstack/react-query';
import { toast } from '@/store/toast.store';

interface ApiError {
  response?: {
    status?: number;
    data?: { message?: string | string[] };
  };
  message?: string;
}

/** Turns an axios/Nest error into something worth showing a person. */
export function describeError(error: unknown): string {
  const err = error as ApiError;
  const message = err?.response?.data?.message;

  if (Array.isArray(message)) return message.join(' · ');
  if (typeof message === 'string' && message.trim()) return message;

  const status = err?.response?.status;
  if (status === 401) return 'Your session has expired. Please sign in again.';
  if (status === 403) return 'You do not have permission to do that.';
  if (status === 404) return 'That item no longer exists.';
  if (status === 413) return 'That file is too large.';
  if (status === 429) return 'Too many attempts. Please wait a moment.';
  if (status && status >= 500) return 'The server had a problem. Please try again.';
  if (!err?.response) return 'Could not reach the server. Check your connection.';

  return err?.message || 'Something went wrong.';
}

/**
 * Every failed mutation reports itself.
 *
 * Without this, a failed action is indistinguishable from a successful one:
 * the request fails, nothing is rendered, and the user is left to guess. That
 * pattern caused three separate bug reports (see Q-020) because each component
 * was expected to handle its own errors and most simply did not.
 *
 * A mutation that shows its own message opts out with `meta: { silent: true }`.
 */
const mutationCache = new MutationCache({
  onError: (error, _variables, _context, mutation) => {
    if (mutation.meta?.silent) return;

    // 401 is handled by the refresh interceptor; surfacing it would produce a
    // spurious toast on every routine token refresh.
    const status = (error as ApiError)?.response?.status;
    if (status === 401) return;

    toast.error('That did not work', describeError(error));
  },
});

/**
 * Whether a failed load deserves a toast.
 *
 * Loads failed as silently as actions did: the moderation page asked for a
 * route that does not exist and rendered "No posts to moderate" instead.
 * Reported here: a load with nothing to show, failing for a reason the page
 * cannot explain itself. Not reported: 401 (the refresh interceptor's job),
 * an ordinary 404 ("no journal entry today" is an answer, not a fault), a
 * failed background refresh of data already on screen, and queries that opt
 * out with `meta: { silent: true }`.
 *
 * A 404 for a route the API does not have is reported, because that is a bug
 * rather than an answer. NestJS phrases it "Cannot GET /api/…".
 */
export function shouldReportQueryError(
  error: unknown,
  query: { meta?: Record<string, unknown>; state: { data: unknown } },
): boolean {
  if (query.meta?.silent) return false;
  if (query.state.data !== undefined) return false;

  const err = error as ApiError;
  const status = err?.response?.status;
  if (status === 401) return false;
  if (status === 404) {
    const message = err?.response?.data?.message;
    return typeof message === 'string' && /^Cannot [A-Z]+ \//.test(message);
  }
  return true;
}

const queryCache = new QueryCache({
  onError: (error, query) => {
    if (!shouldReportQueryError(error, query)) return;
    toast.error('Could not load this', describeError(error));
  },
});

export const queryClient = new QueryClient({
  queryCache,
  mutationCache,
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 10, // 10 minutes
      retry: (failureCount, error: unknown) => {
        const axiosError = error as { response?: { status?: number } };
        if (
          axiosError?.response?.status === 401 ||
          axiosError?.response?.status === 403 ||
          // Asking again will not make it exist.
          axiosError?.response?.status === 404
        ) {
          return false;
        }
        return failureCount < 2;
      },
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: false,
    },
  },
});
