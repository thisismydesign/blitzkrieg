import { QueryClient } from '@tanstack/react-query';

/** Shared TanStack Query client for Supabase-backed server state. */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 60_000, refetchOnWindowFocus: false, retry: 1 },
  },
});
