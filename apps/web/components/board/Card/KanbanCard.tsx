'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { CalendarDays, ListChecks, MessageSquare } from 'lucide-react';
import type { CardWithRelations } from '@fake-trello/shared';

interface KanbanCardProps {
  card: CardWithRelations;
  onClick?: () => void;
}

interface CardSurfaceProps {
  card: CardWithRelations;
  onClick?: () => void;
  dragAttributes?: ReturnType<typeof useSortable>['attributes'];
  dragListeners?: ReturnType<typeof useSortable>['listeners'];
  isOverlay?: boolean;
}

const MAX_VISIBLE_LABELS = 3;

export const cardDndId = (cardId: string) => `card:${cardId}`;

const shortDateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
});

const fullDateFormatter = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function getDueState(dueDate: Date) {
  const today = startOfDay(new Date());
  const due = startOfDay(dueDate);

  if (due.getTime() < today.getTime()) return 'overdue' as const;
  if (due.getTime() === today.getTime()) return 'today' as const;
  return 'upcoming' as const;
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function CardSurface({
  card,
  onClick,
  dragAttributes,
  dragListeners,
  isOverlay = false,
}: CardSurfaceProps) {
  const labels = card.labels ?? [];
  const visibleLabels = labels.slice(0, MAX_VISIBLE_LABELS);
  const hiddenLabelCount = labels.length - visibleLabels.length;

  const checklistItems = card.checklist?.items ?? [];
  const completedItems = checklistItems.filter((item) => item.completed).length;
  const isChecklistComplete =
    checklistItems.length > 0 && completedItems === checklistItems.length;

  const commentCount = card.comments?.length ?? 0;
  const dueDate = card.dueDate ? new Date(card.dueDate) : null;
  const dueState = dueDate ? getDueState(dueDate) : null;

  const dueBadgeClass =
    dueState === 'overdue'
      ? 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-200'
      : dueState === 'today'
        ? 'bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-200'
        : 'bg-gray-50 text-gray-600 ring-1 ring-inset ring-gray-200';

  const className = `flex w-full flex-col gap-2 rounded-xl border border-gray-200 bg-white p-3 text-left ${
    isOverlay
      ? 'cursor-grabbing select-none'
      : 'cursor-grab transition-colors hover:border-gray-300 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 active:cursor-grabbing'
  }`;

  const content = (
    <>
      {visibleLabels.length > 0 && (
        <span className="flex flex-wrap items-center gap-1">
          {visibleLabels.map(({ label }) => (
            <span
              key={label.id}
              title={label.name}
              className="inline-flex max-w-[8rem] items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-700"
            >
              <span
                aria-hidden="true"
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: label.color }}
              />
              <span className="truncate">{label.name}</span>
            </span>
          ))}
          {hiddenLabelCount > 0 && (
            <span
              className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[11px] font-medium text-gray-600 tabular-nums"
              title={labels
                .slice(MAX_VISIBLE_LABELS)
                .map((entry) => entry.label.name)
                .join(', ')}
            >
              +{hiddenLabelCount}
              <span className="sr-only">
                {' '}
                more label{hiddenLabelCount !== 1 ? 's' : ''}
              </span>
            </span>
          )}
        </span>
      )}

      <span className="break-words text-sm font-medium leading-snug text-gray-900 line-clamp-3">
        {card.title}
      </span>

      {(dueDate || checklistItems.length > 0 || commentCount > 0) && (
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          {dueDate && dueState && (
            <span
              className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium tabular-nums ${dueBadgeClass}`}
              title={`Due ${fullDateFormatter.format(dueDate)}`}
            >
              <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
              {dueState === 'overdue' && (
                <span className="sr-only">Overdue: </span>
              )}
              {dueState === 'today' && (
                <span className="sr-only">Due today: </span>
              )}
              <time dateTime={dueDate.toISOString().slice(0, 10)}>
                {shortDateFormatter.format(dueDate)}
              </time>
            </span>
          )}

          {checklistItems.length > 0 && (
            <span
              className={`inline-flex items-center gap-1 text-xs font-medium tabular-nums ${
                isChecklistComplete ? 'text-emerald-700' : 'text-gray-600'
              }`}
            >
              <ListChecks className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="sr-only">
                Checklist: {completedItems} of {checklistItems.length} items
                complete
              </span>
              <span aria-hidden="true">
                {completedItems}/{checklistItems.length}
              </span>
            </span>
          )}

          {commentCount > 0 && (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-600 tabular-nums">
              <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="sr-only">
                {commentCount} comment{commentCount !== 1 ? 's' : ''}
              </span>
              <span aria-hidden="true">{commentCount}</span>
            </span>
          )}

          {card.assignee && (
            <span
              role="img"
              aria-label={`Assigned to ${card.assignee.name}`}
              title={`Assigned to ${card.assignee.name}`}
              className="ml-auto flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-[10px] font-semibold uppercase text-white"
            >
              <span aria-hidden="true">
                {getInitials(card.assignee.name)}
              </span>
            </span>
          )}
        </span>
      )}
    </>
  );

  if (isOverlay) {
    return (
      <div aria-hidden="true" className={className}>
        {content}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={className}
      {...dragAttributes}
      {...dragListeners}
    >
      {content}
    </button>
  );
}

export default function KanbanCard({ card, onClick }: KanbanCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: cardDndId(card.id),
    data: {
      type: 'card',
      cardId: card.id,
      columnId: card.columnId,
      title: card.title,
    },
  });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={isDragging ? 'opacity-40' : undefined}
    >
      <CardSurface
        card={card}
        onClick={onClick}
        dragAttributes={attributes}
        dragListeners={listeners}
      />
    </div>
  );
}

export function KanbanCardPreview({ card }: { card: CardWithRelations }) {
  return <CardSurface card={card} isOverlay />;
}
