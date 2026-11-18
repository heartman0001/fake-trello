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

interface BoardColumnProps {
  column: ColumnWithRelations;
  isFiltered?: boolean;
  onAddCard: (columnId: string, title: string) => void;
  onOpenCard: (card: CardWithRelations) => void;
  onDeleteColumn: (columnId: string) => void;
}

export const columnDndId = (columnId: string) => `column:${columnId}`;
export const columnDropId = (columnId: string) => `card-list:${columnId}`;

export default function BoardColumn({
  column,
  isFiltered = false,
  onAddCard,
  onOpenCard,
  onDeleteColumn,
}: BoardColumnProps) {
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
      className={`flex h-full w-80 shrink-0 flex-col rounded-xl border border-gray-200 bg-gray-100 ${
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
        className={`min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-y-contain px-2 pb-2 ${
          isOver ? 'rounded-lg bg-blue-50/70 ring-1 ring-inset ring-blue-200' : ''
        }`}
        aria-label={`Cards in ${column.title}`}
      >
        <SortableContext
          items={column.cards.map((card) => cardDndId(card.id))}
          strategy={verticalListSortingStrategy}
        >
          {column.cards.map((card) => (
            <KanbanCard
              key={card.id}
              card={card}
              onClick={() => onOpenCard(card)}
            />
          ))}
        </SortableContext>

        {!hasCards && (
          <p className="rounded-lg border border-dashed border-gray-300 px-3 py-6 text-center text-xs leading-relaxed text-gray-500">
            {isFiltered
              ? 'No cards match your filters.'
              : 'No cards yet. Add one below to get started.'}
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
              Card title
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
              placeholder="Enter a card title…"
              className="w-full rounded border-0 bg-transparent px-1 py-1 text-sm text-gray-900 placeholder:text-gray-500 focus:outline-none"
            />
            <div className="mt-2 flex items-center gap-2">
              <button
                type="submit"
                disabled={!cardTitle.trim()}
                className="inline-flex items-center rounded-md bg-blue-600 px-2.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:bg-blue-300"
              >
                Add card
              </button>
              <button
                type="button"
                onClick={closeComposer}
                className="rounded-md px-2 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-500 focus-visible:ring-offset-1"
              >
                Cancel
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
