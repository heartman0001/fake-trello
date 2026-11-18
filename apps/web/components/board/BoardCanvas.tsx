'use client';

import { useId, useMemo, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { generateKeyBetween } from 'fractional-indexing';
import { Plus } from 'lucide-react';
import type {
  CardWithRelations,
  ColumnWithRelations,
} from '@fake-trello/shared';
import BoardColumn, { columnDndId } from './Column/BoardColumn';
import { KanbanCardPreview } from './Card/KanbanCard';
import { useBoardStore } from '@/store/useBoardStore';

export interface MoveCardPayload {
  cardId: string;
  sourceColumnId: string;
  targetColumnId: string;
  position: string | null;
}

interface BoardCanvasProps {
  columns: ColumnWithRelations[];
  isFiltered?: boolean;
  onAddCard: (columnId: string, title: string) => void;
  onOpenCard: (card: CardWithRelations) => void;
  onAddColumn: (title: string) => void;
  onDeleteColumn: (columnId: string) => void;
  onMoveCard: (payload: MoveCardPayload) => void;
  onReorderColumns: (columnIds: string[]) => void;
}

type ActiveDrag =
  | {
      type: 'card';
      card: CardWithRelations;
      width?: number;
      height?: number;
    }
  | {
      type: 'column';
      column: ColumnWithRelations;
      width?: number;
      height?: number;
    };

function toFractionalPosition(before: string | null, after: string | null) {
  try {
    return generateKeyBetween(before, after);
  } catch {
    // Legacy/corrupted keys: let the API append the item instead of failing
    // the whole drag.
    return null;
  }
}

const collisionDetectionStrategy: CollisionDetection = (args) => {
  const activeType = args.active.data.current?.type;

  const droppableContainers =
    activeType === 'column'
      ? args.droppableContainers.filter(
          (container) => container.data.current?.type === 'column',
        )
      : args.droppableContainers.filter((container) => {
          const type = container.data.current?.type;
          return type === 'card' || type === 'card-list';
        });

  return closestCorners({ ...args, droppableContainers });
};

export default function BoardCanvas({
  columns,
  isFiltered = false,
  onAddCard,
  onOpenCard,
  onAddColumn,
  onDeleteColumn,
  onMoveCard,
  onReorderColumns,
}: BoardCanvasProps) {
  const [isAddingColumn, setIsAddingColumn] = useState(false);
  const [columnTitle, setColumnTitle] = useState('');
  const [activeDrag, setActiveDrag] = useState<ActiveDrag | null>(null);
  const columnTitleId = useId();

  const setIsDragging = useBoardStore((state) => state.setIsDragging);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const columnIds = useMemo(
    () => columns.map((column) => columnDndId(column.id)),
    [columns],
  );

  const closeComposer = () => {
    setIsAddingColumn(false);
    setColumnTitle('');
  };

  const handleAddColumn = (event: React.FormEvent) => {
    event.preventDefault();
    const title = columnTitle.trim();
    if (!title) return;

    onAddColumn(title);
    closeComposer();
  };

  const resetDragState = () => {
    setIsDragging(false);
    setActiveDrag(null);
  };

  const handleDragStart = ({ active }: DragStartEvent) => {
    const data = active.data.current;
    const initialRect = active.rect.current.initial;
    const width = initialRect?.width;
    const height = initialRect?.height;

    setIsDragging(true);

    if (data?.type === 'card') {
      const card = columns
        .flatMap((column) => column.cards)
        .find((item) => item.id === data.cardId);

      if (!card) return;

      setActiveDrag({ type: 'card', card, width, height });
      return;
    }

    if (data?.type === 'column') {
      const column = columns.find((item) => item.id === data.columnId);
      if (!column) return;

      setActiveDrag({ type: 'column', column, width, height });
    }
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    const activeData = active.data.current;
    const overData = over?.data.current ?? null;

    resetDragState();

    if (!over || !activeData || !overData) return;

    if (activeData.type === 'column') {
      if (overData.type !== 'column') return;

      const oldIndex = columns.findIndex(
        (column) => column.id === activeData.columnId,
      );
      const newIndex = columns.findIndex(
        (column) => column.id === overData.columnId,
      );

      if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) {
        return;
      }

      onReorderColumns(
        arrayMove(columns, oldIndex, newIndex).map((column) => column.id),
      );
      return;
    }

    if (activeData.type !== 'card') return;

    const activeCardId = activeData.cardId as string;
    const sourceColumnId = activeData.columnId as string;
    const sourceColumn = columns.find(
      (column) => column.id === sourceColumnId,
    );
    const movingCard = sourceColumn?.cards.find(
      (card) => card.id === activeCardId,
    );

    if (!movingCard || !sourceColumn) return;

    let targetColumnId: string | null = null;
    let overCardId: string | null = null;

    if (overData.type === 'card') {
      targetColumnId = overData.columnId as string;
      overCardId = overData.cardId as string;
    } else if (overData.type === 'card-list' || overData.type === 'column') {
      targetColumnId = overData.columnId as string;
    }

    if (!targetColumnId) return;

    if (targetColumnId === sourceColumnId && overCardId === activeCardId) {
      return;
    }

    const targetColumn = columns.find(
      (column) => column.id === targetColumnId,
    );
    if (!targetColumn) return;

    if (
      targetColumnId === sourceColumnId &&
      !overCardId &&
      sourceColumn.cards[sourceColumn.cards.length - 1]?.id === activeCardId
    ) {
      return;
    }

    const targetCards = targetColumn.cards.filter(
      (card) => card.id !== activeCardId,
    );

    let before: string | null = null;
    let after: string | null = null;

    if (overCardId) {
      const overIndex = targetCards.findIndex(
        (card) => card.id === overCardId,
      );

      if (overIndex >= 0) {
        before = targetCards[overIndex - 1]?.position ?? null;
        after = targetCards[overIndex].position ?? null;
      } else {
        before = targetCards[targetCards.length - 1]?.position ?? null;
      }

      // Dragging downward inside the same column should land after the card
      // being hovered, matching the expected sortable behaviour.
      if (targetColumnId === sourceColumnId) {
        const activeIndex = targetColumn.cards.findIndex(
          (card) => card.id === activeCardId,
        );
        const overOriginalIndex = targetColumn.cards.findIndex(
          (card) => card.id === overCardId,
        );

        if (
          activeIndex !== -1 &&
          overOriginalIndex !== -1 &&
          activeIndex < overOriginalIndex &&
          overIndex >= 0
        ) {
          before = targetCards[overIndex].position;
          after = targetCards[overIndex + 1]?.position ?? null;
        }
      }
    } else {
      before = targetCards[targetCards.length - 1]?.position ?? null;
    }

    const position = toFractionalPosition(before, after);

    onMoveCard({
      cardId: activeCardId,
      sourceColumnId,
      targetColumnId,
      position,
    });
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetectionStrategy}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={resetDragState}
      accessibility={{
        screenReaderInstructions: {
          draggable:
            'To pick up a card or column, press space or enter. Use the arrow keys to move it, then press space or enter again to drop it, or escape to cancel.',
        },
        announcements: {
          onDragStart({ active }) {
            const data = active.data.current;
            if (data?.type === 'column') {
              return `Picked up column ${data.title ?? ''}.`;
            }
            return `Picked up card ${data?.title ?? ''}.`;
          },
          onDragOver({ active, over }) {
            const activeData = active.data.current;
            if (!over) return 'Not over a droppable area.';
            const overData = over.data.current;

            if (activeData?.type === 'column') {
              return `Column ${activeData.title ?? ''} is over column ${overData?.title ?? ''}.`;
            }

            return `Card ${activeData?.title ?? ''} is over ${
              overData?.type === 'card'
                ? `card ${overData.title ?? ''}`
                : `the ${overData?.title ?? ''} column`
            }.`;
          },
          onDragEnd({ active, over }) {
            const data = active.data.current;
            if (!over) {
              return `Dropped ${data?.title ?? 'item'} outside a valid target.`;
            }
            return `Dropped ${data?.title ?? 'item'}.`;
          },
          onDragCancel({ active }) {
            return `Dragging cancelled. ${active.data.current?.title ?? 'Item'} returned to its original position.`;
          },
        },
      }}
    >
      <main
        className="flex h-[calc(100vh-64px)] gap-4 overflow-x-auto overflow-y-hidden bg-gray-50 p-6"
        aria-label="Kanban board"
      >
        <SortableContext
          items={columnIds}
          strategy={horizontalListSortingStrategy}
        >
          {columns.map((column) => (
            <BoardColumn
              key={column.id}
              column={column}
              isFiltered={isFiltered}
              onAddCard={onAddCard}
              onOpenCard={onOpenCard}
              onDeleteColumn={onDeleteColumn}
            />
          ))}
        </SortableContext>

        {isAddingColumn ? (
          <form
            onSubmit={handleAddColumn}
            className="h-fit w-80 shrink-0 self-start rounded-xl border border-gray-200 bg-white p-3 shadow-sm"
          >
            <label
              htmlFor={columnTitleId}
              className="mb-1.5 block text-sm font-semibold text-gray-900"
            >
              Add column
            </label>
            <input
              id={columnTitleId}
              type="text"
              name="column-title"
              autoComplete="off"
              autoFocus
              value={columnTitle}
              onChange={(event) => setColumnTitle(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Escape') closeComposer();
              }}
              placeholder="Enter a column title…"
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="mt-2 flex items-center gap-2">
              <button
                type="submit"
                disabled={!columnTitle.trim()}
                className="inline-flex items-center rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:bg-blue-300"
              >
                Add column
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
            onClick={() => setIsAddingColumn(true)}
            className="flex h-fit w-80 shrink-0 flex-col items-center gap-2 self-start rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 px-4 py-8 text-center transition-colors hover:border-blue-400 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
            aria-label="Add a column"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-gray-500 shadow-sm">
              <Plus className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="text-sm font-medium text-gray-700">
              {columns.length === 0 ? 'Create your first column' : 'Add column'}
            </span>
            <span className="text-xs text-gray-500">
              Group cards into a stage of work.
            </span>
          </button>
        )}
      </main>

      <DragOverlay
        dropAnimation={{
          duration: 220,
          easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)',
        }}
      >
        {activeDrag?.type === 'card' && (
          <div
            style={{
              width: activeDrag.width,
              minHeight: activeDrag.height,
            }}
            className="rotate-2 cursor-grabbing rounded-xl shadow-2xl"
          >
            <KanbanCardPreview card={activeDrag.card} />
          </div>
        )}

        {activeDrag?.type === 'column' && (
          <div
            style={{ width: activeDrag.width }}
            className="rotate-2 cursor-grabbing rounded-xl shadow-2xl"
          >
            <div className="rounded-xl border border-gray-200 bg-gray-100 px-3 py-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-gray-800">
                  {activeDrag.column.title}
                </span>
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full border border-gray-200 bg-white px-1.5 text-[11px] font-semibold text-gray-600 tabular-nums">
                  {activeDrag.column.cards.length}
                  <span className="sr-only"> cards</span>
                </span>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Moving column · release to place
              </p>
            </div>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
