'use client';

import { useId, useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Plus, X } from 'lucide-react';
import type { CardWithRelations, ColumnWithRelations } from '@fake-trello/shared';
import KanbanCard, { cardDndId } from '../Card/KanbanCard';
import { usePreferences } from '@/lib/preferences';

interface BoardColumnProps {
  column: ColumnWithRelations;
  previewCardId?: string | null;
  isFiltered?: boolean;
  onAddCard: (columnId: string, title: string) => void;
  onOpenCard: (card: CardWithRelations) => void;
  onDeleteColumn: (columnId: string) => void;
}

export const columnDndId = (columnId: string) => `column:${columnId}`;
export const columnDropId = (columnId: string) => `card-list:${columnId}`;

export default function BoardColumn({
  column,
  previewCardId = null,
  isFiltered = false,
  onAddCard,
  onOpenCard,
  onDeleteColumn,
}: BoardColumnProps) {
  const { t } = usePreferences();
  const [isAddingCard, setIsAddingCard] = useState(false);
  const [cardTitle, setCardTitle] = useState('');
  const headingId = useId();
  const cardTitleId = useId();

  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: columnDndId(column.id),
    data: { type: 'column', columnId: column.id, title: column.title },
  });

  const { setNodeRef: setCardListRef, isOver } = useDroppable({
    id: columnDropId(column.id),
    data: { type: 'card-list', columnId: column.id, title: column.title },
  });

  const cardCount = column.cards.length;
  const hasCards = cardCount > 0;

  const closeComposer = () => {
    setIsAddingCard(false);
    setCardTitle('');
  };

  const handleAddCard = (event: React.FormEvent) => {
    event.preventDefault();
    const title = cardTitle.trim();
    if (!title) return;

    onAddCard(column.id, title);
    closeComposer();
  };

  return (
    <section
      ref={setNodeRef}
      aria-labelledby={headingId}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={`flex h-full w-[min(20rem,calc(100vw-2rem))] shrink-0 flex-col rounded-xl border border-gray-200 bg-gray-100 ${
        isDragging ? 'opacity-40' : ''
      }`}
    >
      <header className="flex items-center justify-between gap-2 px-3 pb-2 pt-3">
        <div className="flex min-w-0 items-center gap-2">
          <button
            ref={setActivatorNodeRef}
            type="button"
            {...attributes}
            {...listeners}
            className="shrink-0 cursor-grab touch-none rounded p-0.5 text-gray-400 transition-colors hover:bg-white hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 active:cursor-grabbing"
            aria-label={`Reorder column ${column.title}`}
          >
            <GripVertical className="h-4 w-4" aria-hidden="true" />
          </button>
          <h2
            id={headingId}
            className="truncate text-sm font-semibold text-gray-800"
          >
            {column.title}
          </h2>
          <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white px-1.5 text-[11px] font-semibold text-gray-600 tabular-nums">
            {cardCount}
            <span className="sr-only"> cards</span>
          </span>
        </div>

        <button
          type="button"
          onClick={() => onDeleteColumn(column.id)}
          className="shrink-0 rounded-md p-1 text-gray-500 transition-colors hover:bg-white hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-1"
          aria-label={`Delete column ${column.title}`}
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </header>

      <div
        ref={setCardListRef}
        role="group"
        className={`min-h-[150px] flex-1 space-y-2 overflow-y-auto overscroll-y-contain px-2 pb-2 ${
          isOver ? 'rounded-lg bg-blue-50/70 ring-1 ring-inset ring-blue-200' : ''
        }`}
        aria-label={`Cards in ${column.title}`}
      >
        <SortableContext
          items={column.cards.map((card) => cardDndId(card.id))}
          strategy={verticalListSortingStrategy}
        >
          {column.cards.map((card) => {
            const isDropPreview = card.id === previewCardId;

            return (
              <div key={card.id} className="relative">
                <KanbanCard
                  card={card}
                  onClick={() => onOpenCard(card)}
                  isDropPreview={isDropPreview}
                />
                {isDropPreview && (
                  <span
                    data-drop-placeholder="true"
                    className="pointer-events-none absolute -top-2 left-2 z-10 rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white shadow-sm"
                  >
                    {t('dropHere')}
                  </span>
                )}
              </div>
            );
          })}
        </SortableContext>

        {!hasCards && (
          <p className="rounded-lg border border-dashed border-gray-300 px-3 py-6 text-center text-xs leading-relaxed text-gray-500">
            {isFiltered ? t('noCardsMatch') : t('noCardsYet')}
          </p>
        )}
      </div>

      <div className="border-t border-gray-200/80 p-2">
        {isAddingCard ? (
          <form
            onSubmit={handleAddCard}
            className="rounded-lg border border-blue-500 bg-white p-2 focus-within:ring-2 focus-within:ring-blue-500"
          >
            <label htmlFor={cardTitleId} className="sr-only">
              {t('cardTitle')}
            </label>
            <input
              id={cardTitleId}
              type="text"
              name="card-title"
              autoComplete="off"
              autoFocus
              value={cardTitle}
              onChange={(event) => setCardTitle(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Escape') closeComposer();
              }}
              placeholder={t('addCardPlaceholder')}
              className="w-full rounded border-0 bg-transparent px-1 py-1 text-sm text-gray-900 placeholder:text-gray-500 focus:outline-none"
            />
            <div className="mt-2 flex items-center gap-2">
              <button
                type="submit"
                disabled={!cardTitle.trim()}
                className="inline-flex items-center rounded-md bg-blue-600 px-2.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:bg-blue-300"
              >
                {t('addCard')}
              </button>
              <button
                type="button"
                onClick={closeComposer}
                className="rounded-md px-2 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-500 focus-visible:ring-offset-1"
              >
                {t('cancel')}
              </button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setIsAddingCard(true)}
            className="flex w-full items-center gap-1.5 rounded-lg px-2 py-2 text-xs font-medium text-gray-600 transition-colors hover:bg-white hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add a card
          </button>
        )}
      </div>
    </section>
  );
}
