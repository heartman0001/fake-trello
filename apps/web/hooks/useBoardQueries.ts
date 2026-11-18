import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { generateKeyBetween } from 'fractional-indexing';
import {
  BoardWithRelations,
  CardWithRelations,
  ChecklistItem,
  ChecklistWithRelations,
  Comment,
  CommentWithUser,
  FractionalIndex,
  Label,
} from '@fake-trello/shared';
import { api } from '@/lib/api';
import type { BoardAnalytics } from '@/types';

const boardKey = (boardId: string) => ['board', boardId];
const analyticsKey = (boardId: string) => [
  'board',
  boardId,
  'analytics',
] as const;

export function useBoard(boardId: string) {
  return useQuery({
    queryKey: boardKey(boardId),
    queryFn: () => api.get<BoardWithRelations>(`/boards/${boardId}`),
    enabled: !!boardId,
  });
}

export function useBoardAnalytics(boardId: string) {
  return useQuery({
    queryKey: analyticsKey(boardId),
    queryFn: () =>
      api.get<BoardAnalytics>(`/boards/${boardId}/analytics`),
    enabled: Boolean(boardId),
    staleTime: 30_000,
  });
}

export function useCreateCard(boardId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      columnId,
      title,
      description,
    }: {
      columnId: string;
      title: string;
      description?: string;
    }) =>
      api.post<CardWithRelations>(
        `/boards/${boardId}/columns/${columnId}/cards`,
        { title, description },
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: boardKey(boardId) }),
  });
}

export function useUpdateCard(boardId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      cardId,
      columnId,
      data,
    }: {
      cardId: string;
      columnId: string;
      data: Record<string, unknown>;
    }) =>
      api.put<CardWithRelations>(
        `/boards/${boardId}/columns/${columnId}/cards/${cardId}`,
        data,
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: boardKey(boardId) }),
  });
}

export interface CardDetailPatch {
  title?: string;
  description?: string;
  dueDate?: string | null;
  assigneeId?: string | null;
}

/**
 * Single-card patch used by the detail modal. The response is merged into the
 * board cache so the board behind the modal stays in sync without a refetch.
 */
export function useUpdateCardDetails(boardId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ cardId, data }: { cardId: string; data: CardDetailPatch }) =>
      api.patch<CardWithRelations>(`/cards/${cardId}`, data),

    onSuccess: (card) => {
      const current = queryClient.getQueryData<BoardWithRelations>(
        boardKey(boardId),
      );

      if (!current) return;

      queryClient.setQueryData<BoardWithRelations>(boardKey(boardId), {
        ...current,
        columns: current.columns.map((column) => ({
          ...column,
          cards: column.cards.map((existing) =>
            existing.id === card.id ? { ...existing, ...card } : existing,
          ),
        })),
      });
    },
  });
}

export function useDeleteCard(boardId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ cardId, columnId }: { cardId: string; columnId: string }) =>
      api.delete(`/boards/${boardId}/columns/${columnId}/cards/${cardId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: boardKey(boardId) }),
  });
}

export function useMoveCard(boardId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      cardId,
      sourceColumnId,
      targetColumnId,
      position,
    }: {
      cardId: string;
      sourceColumnId: string;
      targetColumnId: string;
      position: string | null;
    }) =>
      api.post(
        `/boards/${boardId}/columns/${sourceColumnId}/cards/${cardId}/move`,
        { targetColumnId, position },
      ),

    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: boardKey(boardId) });
      const previous = queryClient.getQueryData<BoardWithRelations>(
        boardKey(boardId),
      );

      if (!previous) {
        return { previous };
      }

      const movedCard = previous.columns
        .flatMap((column) => column.cards)
        .find((card) => card.id === variables.cardId);

      if (!movedCard) {
        return { previous };
      }

      const targetColumn = previous.columns.find(
        (column) => column.id === variables.targetColumnId,
      );

      const targetCards = (targetColumn?.cards ?? []).filter(
        (card) => card.id !== variables.cardId,
      );

      const position =
        variables.position ??
        FractionalIndex.after(
          targetCards[targetCards.length - 1]?.position ?? null,
        );

      // Remove from the source column first, then add to the target column.
      // Chaining the maps also covers a move inside the same column.
      const updated: BoardWithRelations = {
        ...previous,
        columns: previous.columns
          .map((column) => {
            if (column.id === variables.sourceColumnId) {
              return {
                ...column,
                cards: column.cards.filter(
                  (card) => card.id !== variables.cardId,
                ),
              };
            }

            return column;
          })
          .map((column) => {
            if (column.id === variables.targetColumnId) {
              return {
                ...column,
                cards: [
                  ...column.cards,
                  {
                    ...movedCard,
                    columnId: variables.targetColumnId,
                    position,
                  },
                ].sort((a, b) => a.position.localeCompare(b.position)),
              };
            }

            return column;
          }),
      };

      queryClient.setQueryData(boardKey(boardId), updated);
      return { previous };
    },

    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(boardKey(boardId), context.previous);
      }
    },

    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: boardKey(boardId) }),
  });
}

export function useReorderColumn(boardId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (columnIds: string[]) =>
      api.post(`/boards/${boardId}/columns/reorder`, { columnIds }),

    onMutate: async (columnIds) => {
      await queryClient.cancelQueries({ queryKey: boardKey(boardId) });
      const previous = queryClient.getQueryData<BoardWithRelations>(
        boardKey(boardId),
      );

      if (!previous) {
        return { previous };
      }

      const columnsById = new Map(
        previous.columns.map((column) => [column.id, column]),
      );

      let previousPosition: string | null = null;
      const reordered = columnIds.flatMap((columnId) => {
        const column = columnsById.get(columnId);
        if (!column) return [];

        const position = generateKeyBetween(previousPosition, null);
        previousPosition = position;

        return [{ ...column, position }];
      });

      if (reordered.length !== previous.columns.length) {
        return { previous };
      }

      queryClient.setQueryData<BoardWithRelations>(boardKey(boardId), {
        ...previous,
        columns: reordered,
      });

      return { previous };
    },

    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(boardKey(boardId), context.previous);
      }
    },

    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: boardKey(boardId) }),
  });
}

export function useCreateColumn(boardId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (title: string) =>
      api.post(`/boards/${boardId}/columns`, { title }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: boardKey(boardId) }),
  });
}

export function useDeleteColumn(boardId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (columnId: string) =>
      api.delete(`/boards/${boardId}/columns/${columnId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: boardKey(boardId) }),
  });
}

export function useCreateLabel(boardId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { name: string; color: string }) =>
      api.post<Label>(`/boards/${boardId}/labels`, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: boardKey(boardId) }),
  });
}

export function useAddCardLabel(boardId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      cardId,
      columnId,
      labelId,
    }: {
      cardId: string;
      columnId: string;
      labelId: string;
    }) =>
      api.post(
        `/boards/${boardId}/columns/${columnId}/cards/${cardId}/labels/${labelId}`,
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: boardKey(boardId) }),
  });
}

export function useRemoveCardLabel(boardId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      cardId,
      columnId,
      labelId,
    }: {
      cardId: string;
      columnId: string;
      labelId: string;
    }) =>
      api.delete(
        `/boards/${boardId}/columns/${columnId}/cards/${cardId}/labels/${labelId}`,
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: boardKey(boardId) }),
  });
}

const cardPath = (boardId: string, columnId: string, cardId: string) =>
  `/boards/${boardId}/columns/${columnId}/cards/${cardId}/checklists`;

export function useCreateChecklist(boardId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      cardId,
      columnId,
      title,
    }: {
      cardId: string;
      columnId: string;
      title: string;
    }) =>
      api.post<ChecklistWithRelations>(cardPath(boardId, columnId, cardId), {
        title,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: boardKey(boardId) }),
  });
}

export function useAddChecklistItem(boardId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      checklistId,
      cardId,
      columnId,
      title,
    }: {
      checklistId: string;
      cardId: string;
      columnId: string;
      title: string;
    }) =>
      api.post<ChecklistItem>(
        `${cardPath(boardId, columnId, cardId)}/${checklistId}/items`,
        { title },
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: boardKey(boardId) }),
  });
}

export function useUpdateChecklistItem(boardId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      checklistId,
      itemId,
      cardId,
      columnId,
      data,
    }: {
      checklistId: string;
      itemId: string;
      cardId: string;
      columnId: string;
      data: Record<string, unknown>;
    }) =>
      api.put(
        `${cardPath(boardId, columnId, cardId)}/${checklistId}/items/${itemId}`,
        data,
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: boardKey(boardId) }),
  });
}

export function useDeleteChecklistItem(boardId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      checklistId,
      itemId,
      cardId,
      columnId,
    }: {
      checklistId: string;
      itemId: string;
      cardId: string;
      columnId: string;
    }) =>
      api.delete(
        `${cardPath(boardId, columnId, cardId)}/${checklistId}/items/${itemId}`,
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: boardKey(boardId) }),
  });
}

export function useCreateComment(boardId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      cardId,
      columnId,
      content,
    }: {
      cardId: string;
      columnId: string;
      content: string;
    }) =>
      api.post<CommentWithUser>(
        `/boards/${boardId}/columns/${columnId}/cards/${cardId}/comments`,
        { content },
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: boardKey(boardId) }),
  });
}

export function useDeleteComment(boardId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      commentId,
      cardId,
      columnId,
    }: {
      commentId: string;
      cardId: string;
      columnId: string;
    }) =>
      api.delete(
        `/boards/${boardId}/columns/${columnId}/cards/${cardId}/comments/${commentId}`,
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: boardKey(boardId) }),
  });
}

export type { Comment };

