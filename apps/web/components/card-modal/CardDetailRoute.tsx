'use client';

import type { ReactNode } from 'react';
import { AlertCircle, Loader2, X } from 'lucide-react';
import { useBoard } from '@/hooks/useBoardQueries';
import CardDetailModal from './CardDetailModal';

interface CardDetailRouteProps {
  boardId: string;
  cardId: string;
  variant: 'overlay' | 'page';
  onClose: () => void;
}

function CardDetailState({
  variant,
  title,
  description,
  onClose,
  loading = false,
  children,
}: {
  variant: 'overlay' | 'page';
  title: string;
  description: ReactNode;
  onClose: () => void;
  loading?: boolean;
  children?: ReactNode;
}) {
  const panel = (
    <div className="w-full rounded-2xl bg-white p-6 shadow-[0_24px_80px_-24px_rgba(15,23,42,0.5)]">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-2.5">
          {loading ? (
            <Loader2
              className="h-5 w-5 animate-spin text-blue-600"
              aria-hidden="true"
            />
          ) : (
            <AlertCircle
              className="h-5 w-5 text-amber-600"
              aria-hidden="true"
            />
          )}
          <h1 className="text-base font-semibold text-gray-900">{title}</h1>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-1.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          aria-label="Close card"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      <div className="mt-2 text-sm leading-6 text-gray-600">{description}</div>
      {children}
    </div>
  );

  if (variant === 'page') {
    return <div className="mx-auto w-full max-w-2xl px-4 py-12">{panel}</div>;
  }

  return (
    <div
      className="animate-card-overlay fixed inset-0 z-50 overflow-y-auto bg-gray-950/50 px-3 py-4 sm:px-6 sm:py-8"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="mx-auto flex min-h-full w-full max-w-md items-start justify-center">
        <div className="animate-card-panel w-full">{panel}</div>
      </div>
    </div>
  );
}

export default function CardDetailRoute({
  boardId,
  cardId,
  variant,
  onClose,
}: CardDetailRouteProps) {
  const boardQuery = useBoard(boardId);
  const board = boardQuery.data;

  if (boardQuery.isLoading) {
    return (
      <CardDetailState
        variant={variant}
        title="Loading card…"
        description="Fetching the latest details for this card."
        onClose={onClose}
        loading
      />
    );
  }

  if (boardQuery.isError || !board) {
    return (
      <CardDetailState
        variant={variant}
        title="Card unavailable"
        description={
          boardQuery.error instanceof Error
            ? boardQuery.error.message
            : 'The board for this card could not be loaded.'
        }
        onClose={onClose}
      >
        <button
          type="button"
          onClick={() => void boardQuery.refetch()}
          className="mt-4 inline-flex items-center justify-center rounded-md bg-gray-900 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:ring-offset-2"
        >
          Try again
        </button>
      </CardDetailState>
    );
  }

  const card = board.columns
    .flatMap((column) => column.cards)
    .find((entry) => entry.id === cardId);

  if (!card) {
    return (
      <CardDetailState
        variant={variant}
        title="Card not found"
        description="This card may have been deleted or moved to a board you no longer have access to."
        onClose={onClose}
      />
    );
  }

  return (
    <CardDetailModal
      board={board}
      card={card}
      variant={variant}
      onClose={onClose}
    />
  );
}
