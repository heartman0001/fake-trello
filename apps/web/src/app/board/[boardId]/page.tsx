'use client';

import { useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AlertCircle, X } from 'lucide-react';
import type {
  BoardWithRelations,
  CardWithRelations,
  ColumnWithRelations,
} from '@fake-trello/shared';
import BoardHeader, {
  EMPTY_BOARD_FILTERS,
  type BoardFilters,
} from '@/components/board/BoardHeader';
import BoardCanvas from '@/components/board/BoardCanvas';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import {
  useBoard,
  useCreateCard,
  useCreateColumn,
  useDeleteBoard,
  useDeleteColumn,
  useMoveCard,
  useReorderColumn,
} from '@/hooks/useBoardQueries';
import { useBoardSocket } from '@/hooks/useBoardSocket';
import { usePreferences } from '@/lib/preferences';

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function matchesFilters(card: CardWithRelations, filters: BoardFilters) {
  const query = filters.search.trim().toLowerCase();
  if (query) {
    const haystack = `${card.title} ${card.description ?? ''}`.toLowerCase();
    if (!haystack.includes(query)) return false;
  }

  if (filters.labelId) {
    const hasLabel = card.labels.some(
      (entry) => entry.labelId === filters.labelId,
    );
    if (!hasLabel) return false;
  }

  if (filters.due !== 'all') {
    if (!card.dueDate) return false;

    const today = startOfDay(new Date());
    const due = startOfDay(new Date(card.dueDate));

    if (filters.due === 'overdue' && due.getTime() >= today.getTime()) {
      return false;
    }

    if (filters.due === 'today' && due.getTime() !== today.getTime()) {
      return false;
    }

    if (filters.due === 'week') {
      const weekEnd = new Date(today);
      weekEnd.setDate(weekEnd.getDate() + 7);

      if (due.getTime() < today.getTime() || due.getTime() >= weekEnd.getTime()) {
        return false;
      }
    }
  }

  return true;
}

function filterBoard(board: BoardWithRelations, filters: BoardFilters) {
  return board.columns.map((column) => ({
    ...column,
    cards: column.cards.filter((card) => matchesFilters(card, filters)),
  }));
}

export default function BoardPage() {
  const params = useParams<{ boardId: string }>();
  const router = useRouter();
  const { t } = usePreferences();
  const boardId = params.boardId;

  const boardQuery = useBoard(boardId);
  const createCard = useCreateCard(boardId);
  const createColumn = useCreateColumn(boardId);
  const deleteBoard = useDeleteBoard(boardId);
  const deleteColumn = useDeleteColumn(boardId);
  const moveCard = useMoveCard(boardId);
  const reorderColumns = useReorderColumn(boardId);

  const [filters, setFilters] = useState<BoardFilters>(EMPTY_BOARD_FILTERS);
  const [isDeleteBoardOpen, setIsDeleteBoardOpen] = useState(false);
  const [deleteBoardError, setDeleteBoardError] = useState<string | null>(null);
  const [columnToDelete, setColumnToDelete] =
    useState<ColumnWithRelations | null>(null);
  const [deleteColumnError, setDeleteColumnError] = useState<string | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  // The API resolves the caller's role from workspace/board membership.
  const memberRole = boardQuery.data?.workspaceMemberRole ?? 'MEMBER';

  useBoardSocket(boardId);

  const board = boardQuery.data;

  const totalCards = useMemo(
    () =>
      board?.columns.reduce((sum, column) => sum + column.cards.length, 0) ?? 0,
    [board],
  );

  const isFiltered =
    filters.search.trim() !== '' ||
    filters.labelId !== '' ||
    filters.due !== 'all';

  const visibleColumns = useMemo(
    () => (board && isFiltered ? filterBoard(board, filters) : board?.columns ?? []),
    [board, filters, isFiltered],
  );

  const visibleCardCount = useMemo(
    () =>
      visibleColumns.reduce((sum, column) => sum + column.cards.length, 0),
    [visibleColumns],
  );

  if (boardQuery.isLoading) {
    return (
      <div className="min-h-screen">
        <div className="h-16 animate-pulse border-b border-gray-200 bg-white" />
        <div className="flex gap-4 p-6" aria-hidden="true">
          {[0, 1, 2].map((key) => (
            <div
              key={key}
              className="h-72 w-80 shrink-0 animate-pulse rounded-xl bg-gray-200"
            />
          ))}
        </div>
        <p className="sr-only" role="status">
          {t('loadingBoard')}
        </p>
      </div>
    );
  }

  if (boardQuery.isError || !board) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-gray-50 px-4 text-center">
        <h1 className="text-lg font-semibold text-gray-900">
          {t('boardUnavailable')}
        </h1>
        <p className="max-w-sm text-sm text-gray-500">
          {boardQuery.error instanceof Error
            ? boardQuery.error.message
            : t('boardUnavailableDescription')}
        </p>
        <a
          href="/workspaces"
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
        >
          {t('back')}
        </a>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <BoardHeader
        boardId={boardId}
        boardTitle={board.title}
        workspaceName={board.workspaceName}
        members={board.members}
        labels={board.labels}
        columnCount={board.columns.length}
        cardCount={totalCards}
        visibleCardCount={visibleCardCount}
        filters={filters}
        onFiltersChange={setFilters}
        memberRole={memberRole}
        workspaceId={board.workspaceId}
        onDeleteBoard={() => {
          setIsDeleteBoardOpen(true);
          setDeleteBoardError(null);
        }}
      />

      <BoardCanvas
        columns={visibleColumns}
        isFiltered={isFiltered}
        onAddCard={(columnId, title) =>
          createCard.mutate(
            { columnId, title },
            { onError: (err) => setError(err.message) },
          )
        }
        onOpenCard={(card) =>
          router.push(`/board/${boardId}/cards/${card.id}`)
        }
        onAddColumn={(title) =>
          createColumn.mutate(title, {
            onError: (err) => setError(err.message),
          })
        }
        onDeleteColumn={(columnId) => {
          const column = board.columns.find((entry) => entry.id === columnId);
          if (!column) return;

          setColumnToDelete(column);
          setDeleteColumnError(null);
        }}
        onMoveCard={(payload) =>
          moveCard.mutate(payload, {
            onError: (err) => setError(err.message),
          })
        }
        onReorderColumns={(columnIds) =>
          reorderColumns.mutate(columnIds, {
            onError: (err) => setError(err.message),
          })
        }
      />

      {isDeleteBoardOpen && (
        <ConfirmDialog
          open
          title={t('deleteBoardTitle')}
          description={t('deleteBoardDescription', { name: board.title })}
          summary={t('deleteBoardSummary', {
            columns: t(
              board.columns.length === 1
                ? 'columnCount'
                : 'columnCountPlural',
              { count: board.columns.length },
            ),
            cards: t(totalCards === 1 ? 'cardCount' : 'cardCountPlural', {
              count: totalCards,
            }),
          })}
          confirmLabel={t('deleteBoard')}
          pendingLabel={t('deleting')}
          isPending={deleteBoard.isPending}
          error={deleteBoardError}
          onConfirm={() => {
            if (deleteBoard.isPending) return;

            deleteBoard.mutate(undefined, {
              onSuccess: () => {
                setIsDeleteBoardOpen(false);
                setDeleteBoardError(null);
                router.push('/workspaces');
              },
              onError: (err) => setDeleteBoardError(err.message),
            });
          }}
          onClose={() => {
            if (deleteBoard.isPending) return;
            setIsDeleteBoardOpen(false);
            setDeleteBoardError(null);
          }}
        />
      )}

      {columnToDelete && (
        <ConfirmDialog
          open
          title={t('deleteColumnTitle')}
          description={
            columnToDelete.cards.length === 0
              ? t('deleteColumnNoCards', { name: columnToDelete.title })
              : t('deleteColumnWithCards', {
                  name: columnToDelete.title,
                  count: columnToDelete.cards.length,
                })
          }
          summary={
            columnToDelete.cards.length === 0
              ? t('deleteColumnEmptySummary')
              : t('deleteColumnSummary', {
                  count: columnToDelete.cards.length,
                })
          }
          confirmLabel={t('deleteColumn')}
          pendingLabel={t('deleting')}
          isPending={deleteColumn.isPending}
          error={deleteColumnError}
          onConfirm={() => {
            if (deleteColumn.isPending) return;

            deleteColumn.mutate(columnToDelete.id, {
              onSuccess: () => {
                setColumnToDelete(null);
                setDeleteColumnError(null);
              },
              onError: (err) => setDeleteColumnError(err.message),
            });
          }}
          onClose={() => {
            if (deleteColumn.isPending) return;
            setColumnToDelete(null);
            setDeleteColumnError(null);
          }}
        />
      )}

      {error && (
        <div
          role="alert"
          className="fixed bottom-4 left-1/2 z-40 flex w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 items-start gap-2 rounded-lg border border-red-200 bg-white px-3 py-2.5 text-sm text-gray-900 shadow-lg"
        >
          <AlertCircle
            className="mt-0.5 h-4 w-4 shrink-0 text-red-600"
            aria-hidden="true"
          />
          <p className="min-w-0 flex-1">{error}</p>
          <button
            type="button"
            onClick={() => setError(null)}
            className="shrink-0 rounded p-0.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            aria-label={t('dismissError')}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}

    </div>
  );
}
