'use client';

import { useEffect } from 'react';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import type { Socket } from 'socket.io-client';
import type {
  BoardWithRelations,
  CardWithRelations,
} from '@fake-trello/shared';
import { createBoardSocket } from '@/lib/socket';
import { useBoardStore, type PendingSocketEvent } from '@/store/useBoardStore';

type BoardSocketEvent =
  | 'card:created'
  | 'card:updated'
  | 'card:moved'
  | 'column:reordered';

const BOARD_EVENTS: BoardSocketEvent[] = [
  'card:created',
  'card:updated',
  'card:moved',
  'column:reordered',
];

const boardQueryKey = (boardId: string) => ['board', boardId] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function sortCards(cards: CardWithRelations[]) {
  return [...cards].sort((a, b) => a.position.localeCompare(b.position));
}

/**
 * Applies card:created, card:updated and card:moved to the cached board.
 * The three events all carry a full card payload, so they share an upsert:
 * remove any existing copy from every column, then insert the merged card
 * into its target column at the position it was assigned on the server.
 */
function upsertCard(
  board: BoardWithRelations,
  payload: unknown,
): BoardWithRelations | null {
  if (!isRecord(payload)) return null;

  const cardId = payload.id;
  const columnId = payload.columnId;

  if (typeof cardId !== 'string' || typeof columnId !== 'string') {
    return null;
  }

  const targetColumn = board.columns.find(
    (column) => column.id === columnId,
  );

  if (!targetColumn) return null;

  const existingCard = board.columns
    .flatMap((column) => column.cards)
    .find((card) => card.id === cardId);

  const nextCard = (
    existingCard ? { ...existingCard, ...payload } : payload
  ) as unknown as CardWithRelations;

  const columns = board.columns.map((column) => {
    const withoutCard = column.cards.filter((card) => card.id !== cardId);

    if (column.id !== columnId) {
      if (withoutCard.length === column.cards.length) return column;
      return { ...column, cards: withoutCard };
    }

    return {
      ...column,
      cards: sortCards([...withoutCard, nextCard]),
    };
  });

  return { ...board, columns };
}

/**
 * Accepts either an ordered list of column ids or a list of column payloads
 * (with optional position/title updates) from column:reordered.
 */
function reorderColumns(
  board: BoardWithRelations,
  payload: unknown,
): BoardWithRelations | null {
  const list = Array.isArray(payload)
    ? payload
    : isRecord(payload) && Array.isArray(payload.columns)
      ? payload.columns
      : null;

  if (!list || list.length === 0) return null;

  if (list.every((item) => typeof item === 'string')) {
    const columnsById = new Map(
      board.columns.map((column) => [column.id, column]),
    );

    const ordered = list.flatMap((id) => {
      const column = columnsById.get(id as string);
      return column ? [column] : [];
    });

    if (ordered.length !== board.columns.length) return null;

    return { ...board, columns: ordered };
  }

  const updates = new Map<string, Record<string, unknown>>();

  for (const item of list) {
    if (isRecord(item) && typeof item.id === 'string') {
      updates.set(item.id, item);
    }
  }

  if (updates.size === 0) return null;

  const hasPositions = [...updates.values()].every(
    (update) => typeof update.position === 'string',
  );

  const merged = board.columns.map((column) => {
    const update = updates.get(column.id);
    if (!update) return column;

    return {
      ...column,
      position:
        typeof update.position === 'string' ? update.position : column.position,
      title: typeof update.title === 'string' ? update.title : column.title,
    };
  });

  if (hasPositions) {
    return {
      ...board,
      columns: [...merged].sort((a, b) =>
        a.position.localeCompare(b.position),
      ),
    };
  }

  const order = new Map(
    [...updates.keys()].map((id, index) => [id, index] as const),
  );

  return {
    ...board,
    columns: [...merged].sort(
      (a, b) =>
        (order.get(a.id) ?? Number.MAX_SAFE_INTEGER) -
        (order.get(b.id) ?? Number.MAX_SAFE_INTEGER),
    ),
  };
}

function applySocketEvents(
  queryClient: QueryClient,
  boardId: string,
  events: PendingSocketEvent[],
) {
  const key = boardQueryKey(boardId);
  const board = queryClient.getQueryData<BoardWithRelations>(key);

  // The board is not in the cache yet: the active query will fetch it.
  if (!board) return;

  let nextBoard = board;
  let needsRefetch = false;

  for (const event of events) {
    const next =
      event.event === 'column:reordered'
        ? reorderColumns(nextBoard, event.data)
        : upsertCard(nextBoard, event.data);

    if (next) {
      nextBoard = next;
    } else {
      // Payload did not match the cached shape; fall back to a refetch once
      // all events have been applied.
      needsRefetch = true;
    }
  }

  if (nextBoard !== board) {
    queryClient.setQueryData<BoardWithRelations>(key, nextBoard);
  }

  if (needsRefetch) {
    queryClient.invalidateQueries({ queryKey: key });
  }
}

/**
 * Keeps a Socket.io connection to the current board room alive while the
 * board page is mounted.
 *
 * While a drag is in progress, incoming events are queued in the Zustand
 * board store instead of touching the query cache, so remote updates cannot
 * yank a card out from under the pointer. When the drag ends and
 * `isDragging` flips back to false, the queue is flushed against the latest
 * cached board in a single cache write.
 */
export function useBoardSocket(boardId: string) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!boardId) return;

    const flushPendingEvents = () => {
      const { pendingSocketEvents, clearPendingSocketEvents } =
        useBoardStore.getState();

      if (pendingSocketEvents.length === 0) return;

      clearPendingSocketEvents();
      applySocketEvents(queryClient, boardId, pendingSocketEvents);
    };

    const socket: Socket = createBoardSocket(boardId);
    const handlers = new Map<BoardSocketEvent, (data: unknown) => void>();

    for (const event of BOARD_EVENTS) {
      const handler = (data: unknown) => {
        const store = useBoardStore.getState();

        // While dragging, or while an earlier queue is still waiting for its
        // scheduled flush, preserve arrival order by queueing instead of
        // applying straight to the cache.
        if (store.isDragging || store.pendingSocketEvents.length > 0) {
          store.addPendingSocketEvent(event, data);
          return;
        }

        applySocketEvents(queryClient, boardId, [
          { event, data, timestamp: Date.now() },
        ]);
      };

      handlers.set(event, handler);
      socket.on(event, handler);
    }

    let flushTimer: ReturnType<typeof setTimeout> | null = null;

    const unsubscribeDragState = useBoardStore.subscribe((state, previous) => {
      if (previous.isDragging && !state.isDragging) {
        if (flushTimer) clearTimeout(flushTimer);

        // Let onDragEnd start its optimistic mutation before replays land.
        flushTimer = setTimeout(flushPendingEvents, 0);
      }
    });

    return () => {
      if (flushTimer) clearTimeout(flushTimer);

      handlers.forEach((handler, event) => {
        socket.off(event, handler);
      });

      socket.emit('board:leave', { boardId });
      socket.disconnect();
      unsubscribeDragState();

      // Queued events belong to the board instance that is unmounting.
      useBoardStore.getState().clearPendingSocketEvents();
    };
  }, [boardId, queryClient]);
}

export type { BoardSocketEvent };
