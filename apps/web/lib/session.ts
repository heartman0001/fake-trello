import type { QueryClient } from '@tanstack/react-query';
import { useBoardStore } from '@/store/useBoardStore';

/**
 * Removes all in-memory data that belongs to the signed-in account. Query
 * cache entries are not user-scoped, so every auth transition must clear them
 * before another account can reuse the same client instance.
 */
export function clearClientSession(queryClient: QueryClient) {
  void queryClient.cancelQueries();
  queryClient.clear();

  const boardStore = useBoardStore.getState();
  boardStore.resetDragState();
  boardStore.clearPendingSocketEvents();
}
