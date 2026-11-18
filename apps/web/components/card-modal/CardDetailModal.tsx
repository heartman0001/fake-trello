'use client';

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import {
  AlertCircle,
  CalendarDays,
  Check,
  Columns3,
  Loader2,
  MessageSquare,
  Plus,
  Tag,
  Trash2,
  X,
} from 'lucide-react';
import type {
  BoardWithRelations,
  CardWithRelations,
} from '@fake-trello/shared';
import { useAuthStore } from '@/store/useAuthStore';
import {
  useAddCardLabel,
  useAddChecklistItem,
  useCreateChecklist,
  useCreateComment,
  useDeleteCard,
  useDeleteChecklistItem,
  useDeleteComment,
  useRemoveCardLabel,
  useUpdateCardDetails,
  useUpdateChecklistItem,
} from '@/hooks/useBoardQueries';
import {
  useCardAutosave,
  type AutosaveStatus,
} from '@/hooks/useCardAutosave';

type CardDetailModalVariant = 'overlay' | 'page';

interface CardDetailModalProps {
  board: BoardWithRelations;
  card: CardWithRelations;
  variant?: CardDetailModalVariant;
  onClose: () => void;
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function toDateInputValue(value: Date | string | null | undefined) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function formatDueDate(value: Date | string) {
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value));
}

function formatRelativeTime(value: Date | string) {
  const date = new Date(value);
  const diffMs = Date.now() - date.getTime();

  if (Number.isNaN(diffMs)) return '';
  if (diffMs < 60_000) return 'just now';

  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;

  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
  }).format(date);
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong.';
}

function SaveStatus({
  status,
  error,
  onRetry,
}: {
  status: AutosaveStatus;
  error: string | null;
  onRetry: () => void;
}) {
  if (status === 'error') {
    return (
      <span
        role="status"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-red-600"
      >
        <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
        {error ?? 'Could not save'}
        <button
          type="button"
          onClick={onRetry}
          className="rounded underline decoration-red-300 underline-offset-2 transition-colors hover:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
        >
          Retry
        </button>
      </span>
    );
  }

  if (status === 'saved') {
    return (
      <span
        role="status"
        aria-live="polite"
        className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700"
      >
        <Check className="h-3.5 w-3.5" aria-hidden="true" />
        Saved
      </span>
    );
  }

  if (status === 'pending' || status === 'saving') {
    return (
      <span
        role="status"
        aria-live="polite"
        className="inline-flex items-center gap-1 text-xs font-medium text-gray-500"
      >
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
        Saving…
      </span>
    );
  }

  return (
    <span className="text-xs text-gray-500">Changes save automatically</span>
  );
}

export default function CardDetailModal({
  board,
  card,
  variant = 'overlay',
  onClose,
}: CardDetailModalProps) {
  const currentUser = useAuthStore((state) => state.user);
  const column = board.columns.find((entry) => entry.id === card.columnId);

  const autosave = useCardAutosave(board.id, card);

  const updateCardDetails = useUpdateCardDetails(board.id);
  const deleteCard = useDeleteCard(board.id);
  const addLabel = useAddCardLabel(board.id);
  const removeLabel = useRemoveCardLabel(board.id);
  const createChecklist = useCreateChecklist(board.id);
  const addChecklistItem = useAddChecklistItem(board.id);
  const updateChecklistItem = useUpdateChecklistItem(board.id);
  const deleteChecklistItem = useDeleteChecklistItem(board.id);
  const createComment = useCreateComment(board.id);
  const deleteComment = useDeleteComment(board.id);

  const [newItem, setNewItem] = useState('');
  const [newComment, setNewComment] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const checklist = card.checklist;
  const items = checklist?.items ?? [];
  const completedCount = items.filter((item) => item.completed).length;
  const progress = items.length
    ? Math.round((completedCount / items.length) * 100)
    : 0;

  const assignedLabelIds = useMemo(
    () => new Set(card.labels.map((entry) => entry.labelId)),
    [card.labels],
  );

  const dueDate = card.dueDate ? new Date(card.dueDate) : null;
  const dueIsOverdue = Boolean(
    dueDate && startOfDay(dueDate) < startOfDay(new Date()),
  );
  const dueIsToday = Boolean(
    dueDate &&
      startOfDay(dueDate).getTime() === startOfDay(new Date()).getTime(),
  );

  const run = async (action: () => Promise<unknown>) => {
    setActionError(null);
    try {
      await action();
    } catch (error) {
      setActionError(getErrorMessage(error));
    }
  };

  const handleAddItem = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = newItem.trim();
    if (!trimmed) return;

    setActionError(null);
    try {
      let checklistId = checklist?.id;

      if (!checklistId) {
        const created = await createChecklist.mutateAsync({
          cardId: card.id,
          columnId: card.columnId,
          title: 'Checklist',
        });
        checklistId = created.id;
      }

      await addChecklistItem.mutateAsync({
        checklistId,
        cardId: card.id,
        columnId: card.columnId,
        title: trimmed,
      });
      setNewItem('');
    } catch (error) {
      setActionError(getErrorMessage(error));
    }
  };

  const handleAddComment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = newComment.trim();
    if (!trimmed) return;

    setActionError(null);
    try {
      await createComment.mutateAsync({
        cardId: card.id,
        columnId: card.columnId,
        content: trimmed,
      });
      setNewComment('');
    } catch (error) {
      setActionError(getErrorMessage(error));
    }
  };

  const handleCommentKeyDown = (
    event: ReactKeyboardEvent<HTMLTextAreaElement>,
  ) => {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  };

  const handleDeleteCard = async () => {
    setActionError(null);
    try {
      await deleteCard.mutateAsync({
        cardId: card.id,
        columnId: card.columnId,
      });
      onClose();
    } catch (error) {
      setActionError(getErrorMessage(error));
      setConfirmingDelete(false);
    }
  };

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  useEffect(() => {
    if (variant !== 'overlay') return;

    const previousOverflow = document.body.style.overflow;
    const previouslyFocused =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    document.body.style.overflow = 'hidden';

    const handleTab = (event: KeyboardEvent) => {
      if (event.key !== 'Tab' || !panelRef.current) return;

      const focusable = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => element.offsetParent !== null);

      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleTab);

    return () => {
      document.removeEventListener('keydown', handleTab);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  }, [variant]);

  const isOverlay = variant === 'overlay';

  const panel = (
    <div
      ref={panelRef}
      role="dialog"
      aria-modal={isOverlay}
      aria-labelledby="card-detail-title"
      className={`flex w-full flex-col overflow-hidden rounded-2xl bg-white shadow-[0_24px_80px_-24px_rgba(15,23,42,0.5)] ${
        isOverlay
          ? 'animate-card-panel max-h-[calc(100dvh-2rem)] sm:max-h-[calc(100dvh-4rem)]'
          : ''
      }`}
    >
      <header className="flex items-start gap-3 border-b border-gray-200 px-5 py-4 sm:px-6 sm:py-5">
        <div className="min-w-0 flex-1">
          <label htmlFor="card-detail-title" className="sr-only">
            Card title
          </label>
          <input
            id="card-detail-title"
            value={autosave.title}
            onChange={(event) => autosave.setTitle(event.target.value)}
            onBlur={autosave.handleTitleBlur}
            autoFocus
            maxLength={200}
            className="w-full rounded-md border border-transparent bg-transparent px-1 py-0.5 text-xl font-semibold tracking-[-0.02em] text-gray-900 transition-colors hover:border-gray-300 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 sm:text-2xl"
          />
          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 px-1 text-xs text-gray-500">
            <span className="inline-flex min-w-0 items-center gap-1">
              <Columns3 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span className="truncate">{column?.title ?? 'List'}</span>
            </span>
            <span aria-hidden="true">·</span>
            <span className="max-w-[14rem] truncate">{board.title}</span>
            <span aria-hidden="true">·</span>
            <SaveStatus
              status={autosave.status}
              error={autosave.error}
              onRetry={autosave.flushNow}
            />
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded-md p-1.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          aria-label="Close card"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </header>

      {actionError && (
        <div
          role="alert"
          className="flex items-start gap-2 border-b border-red-100 bg-red-50 px-5 py-2.5 text-sm text-red-700 sm:px-6"
        >
          <AlertCircle
            className="mt-0.5 h-4 w-4 shrink-0"
            aria-hidden="true"
          />
          <p className="min-w-0 flex-1">{actionError}</p>
          <button
            type="button"
            onClick={() => setActionError(null)}
            className="shrink-0 rounded p-0.5 text-red-500 transition-colors hover:bg-red-100 hover:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
            aria-label="Dismiss error"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}

      <div className={isOverlay ? 'overflow-y-auto' : ''}>
        <div className="grid gap-8 px-5 py-5 sm:px-6 md:grid-cols-[minmax(0,1fr)_232px] md:gap-10">
          <div className="min-w-0 space-y-7">
            <section>
              <h3 className="text-sm font-semibold text-gray-900">
                Description
              </h3>
              <label htmlFor="card-description" className="sr-only">
                Card description
              </label>
              <textarea
                id="card-description"
                rows={5}
                value={autosave.description}
                onChange={(event) => autosave.setDescription(event.target.value)}
                onBlur={autosave.handleDescriptionBlur}
                placeholder="Add a more detailed description…"
                className="mt-2 w-full resize-y rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm leading-6 text-gray-800 transition-colors placeholder:text-gray-500 hover:border-gray-300 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/25"
              />
            </section>

            <section aria-labelledby="checklist-heading">
              <div className="flex items-baseline justify-between gap-3">
                <h3
                  id="checklist-heading"
                  className="text-sm font-semibold text-gray-900"
                >
                  Checklist
                  <span className="ml-2 text-xs font-normal tabular-nums text-gray-500">
                    {completedCount}/{items.length}
                  </span>
                </h3>
                <span className="text-xs font-medium tabular-nums text-gray-500">
                  {progress}%
                </span>
              </div>

              <div
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={progress}
                aria-label="Checklist progress"
                className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-100"
              >
                <div
                  className="h-full rounded-full bg-emerald-500 transition-[width] duration-300 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>

              {items.length === 0 ? (
                <p className="mt-3 rounded-lg border border-dashed border-gray-200 px-3 py-4 text-center text-xs leading-5 text-gray-500">
                  Break this card into smaller steps. The first item creates the
                  checklist.
                </p>
              ) : (
                <ul className="mt-3 space-y-0.5">
                  {items.map((item) => (
                    <li
                      key={item.id}
                      className="group flex items-center gap-2.5 rounded-md px-1.5 py-1.5 transition-colors hover:bg-gray-50"
                    >
                      <input
                        type="checkbox"
                        checked={item.completed}
                        disabled={updateChecklistItem.isPending}
                        onChange={(event) =>
                          run(() =>
                            updateChecklistItem.mutateAsync({
                              checklistId: item.checklistId,
                              itemId: item.id,
                              cardId: card.id,
                              columnId: card.columnId,
                              data: { completed: event.target.checked },
                            }),
                          )
                        }
                        className="h-4 w-4 shrink-0 cursor-pointer rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 disabled:cursor-wait"
                        aria-label={`Mark ${item.title} as ${
                          item.completed ? 'incomplete' : 'complete'
                        }`}
                      />
                      <span
                        className={`min-w-0 flex-1 break-words text-sm leading-5 ${
                          item.completed
                            ? 'text-gray-500 line-through decoration-gray-400'
                            : 'text-gray-700'
                        }`}
                      >
                        {item.title}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          run(() =>
                            deleteChecklistItem.mutateAsync({
                              checklistId: item.checklistId,
                              itemId: item.id,
                              cardId: card.id,
                              columnId: card.columnId,
                            }),
                          )
                        }
                        disabled={deleteChecklistItem.isPending}
                        className="shrink-0 rounded p-1 text-gray-300 transition-colors hover:bg-white hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:cursor-wait sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
                        aria-label={`Delete checklist item ${item.title}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <form onSubmit={handleAddItem} className="mt-2 flex gap-2">
                <label htmlFor="new-checklist-item" className="sr-only">
                  New checklist item
                </label>
                <input
                  id="new-checklist-item"
                  value={newItem}
                  onChange={(event) => setNewItem(event.target.value)}
                  placeholder="Add an item"
                  maxLength={200}
                  className="min-w-0 flex-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm transition-colors placeholder:text-gray-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/25"
                />
                <button
                  type="submit"
                  disabled={
                    !newItem.trim() ||
                    createChecklist.isPending ||
                    addChecklistItem.isPending
                  }
                  className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md bg-gray-900 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-gray-300"
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  Add
                </button>
              </form>
            </section>

            <section aria-labelledby="comments-heading">
              <h3
                id="comments-heading"
                className="text-sm font-semibold text-gray-900"
              >
                Comments
                <span className="ml-2 text-xs font-normal tabular-nums text-gray-500">
                  {card.comments.length}
                </span>
              </h3>

              {card.comments.length === 0 ? (
                <div className="mt-2 flex items-center gap-2.5 rounded-lg border border-dashed border-gray-200 px-3 py-4 text-xs text-gray-500">
                  <MessageSquare
                    className="h-4 w-4 shrink-0 text-gray-400"
                    aria-hidden="true"
                  />
                  No comments yet. Start the conversation below.
                </div>
              ) : (
                <ul className="mt-3 space-y-4">
                  {card.comments.map((comment) => (
                    <li key={comment.id} className="flex gap-2.5">
                      <div
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-50 text-[11px] font-semibold uppercase text-blue-700"
                        aria-hidden="true"
                      >
                        {comment.user.name.slice(0, 2)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <p className="truncate text-xs font-semibold text-gray-800">
                            {comment.user.name}
                          </p>
                          <div className="flex shrink-0 items-center gap-2">
                            <time
                              dateTime={new Date(comment.createdAt).toISOString()}
                              className="text-[11px] text-gray-500"
                            >
                              {formatRelativeTime(comment.createdAt)}
                            </time>
                            {currentUser?.id === comment.userId && (
                              <button
                                type="button"
                                onClick={() =>
                                  run(() =>
                                    deleteComment.mutateAsync({
                                      commentId: comment.id,
                                      cardId: card.id,
                                      columnId: card.columnId,
                                    }),
                                  )
                                }
                                disabled={deleteComment.isPending}
                                className="rounded text-[11px] font-medium text-gray-500 transition-colors hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:cursor-wait"
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        </div>
                        <p className="mt-1 whitespace-pre-wrap break-words rounded-lg bg-gray-50 px-3 py-2 text-sm leading-6 text-gray-700">
                          {comment.content}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              <form onSubmit={handleAddComment} className="mt-3">
                <label htmlFor="new-comment" className="sr-only">
                  Write a comment
                </label>
                <textarea
                  id="new-comment"
                  rows={3}
                  value={newComment}
                  onChange={(event) => setNewComment(event.target.value)}
                  onKeyDown={handleCommentKeyDown}
                  placeholder="Write a comment…"
                  className="w-full resize-y rounded-lg border border-gray-300 px-3 py-2 text-sm leading-6 transition-colors placeholder:text-gray-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/25"
                />
                <div className="mt-2 flex items-center justify-between gap-3">
                  <p className="text-[11px] text-gray-500">
                    <kbd className="rounded border border-gray-200 bg-gray-50 px-1 font-sans">
                      ⌘/Ctrl
                    </kbd>{' '}
                    + Enter to send
                  </p>
                  <button
                    type="submit"
                    disabled={!newComment.trim() || createComment.isPending}
                    className="inline-flex items-center justify-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-blue-300"
                  >
                    {createComment.isPending && (
                      <Loader2
                        className="h-3.5 w-3.5 animate-spin"
                        aria-hidden="true"
                      />
                    )}
                    Comment
                  </button>
                </div>
              </form>
            </section>
          </div>

          <aside className="space-y-7 border-t border-gray-200 pt-6 md:border-t-0 md:pt-1">
            <section aria-labelledby="due-date-heading">
              <h3
                id="due-date-heading"
                className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500"
              >
                <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                Due date
              </h3>
              <div className="mt-2">
                <input
                  type="date"
                  value={toDateInputValue(card.dueDate)}
                  disabled={updateCardDetails.isPending}
                  onChange={(event) => {
                    const value = event.target.value;
                    run(() =>
                      updateCardDetails.mutateAsync({
                        cardId: card.id,
                        data: {
                          dueDate: value
                            ? new Date(`${value}T12:00:00`).toISOString()
                            : null,
                        },
                      }),
                    );
                  }}
                  aria-label="Due date"
                  className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm text-gray-800 transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/25 disabled:cursor-wait disabled:bg-gray-50"
                />
                <div className="mt-1.5 flex min-h-[1rem] items-center justify-between gap-2">
                  <p
                    className={`text-[11px] ${
                      dueIsOverdue
                        ? 'font-medium text-red-600'
                        : dueIsToday
                          ? 'font-medium text-amber-700'
                          : 'text-gray-500'
                    }`}
                  >
                    {dueDate
                      ? dueIsOverdue
                        ? `Overdue · ${formatDueDate(dueDate)}`
                        : dueIsToday
                          ? 'Due today'
                          : formatDueDate(dueDate)
                      : 'No due date'}
                  </p>
                  {card.dueDate && (
                    <button
                      type="button"
                      onClick={() =>
                        run(() =>
                          updateCardDetails.mutateAsync({
                            cardId: card.id,
                            data: { dueDate: null },
                          }),
                        )
                      }
                      disabled={updateCardDetails.isPending}
                      className="inline-flex items-center gap-0.5 rounded text-[11px] font-medium text-gray-500 transition-colors hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-wait"
                    >
                      <X className="h-3 w-3" aria-hidden="true" />
                      Clear
                    </button>
                  )}
                </div>
              </div>
            </section>

            <section aria-labelledby="labels-heading">
              <h3
                id="labels-heading"
                className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500"
              >
                <Tag className="h-3.5 w-3.5" aria-hidden="true" />
                Labels
              </h3>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {(board.labels ?? []).map((label) => {
                  const active = assignedLabelIds.has(label.id);
                  const busy = addLabel.isPending || removeLabel.isPending;

                  return (
                    <button
                      key={label.id}
                      type="button"
                      aria-pressed={active}
                      disabled={busy}
                      onClick={() =>
                        run(() =>
                          active
                            ? removeLabel.mutateAsync({
                                cardId: card.id,
                                columnId: card.columnId,
                                labelId: label.id,
                              })
                            : addLabel.mutateAsync({
                                cardId: card.id,
                                columnId: card.columnId,
                                labelId: label.id,
                              }),
                        )
                      }
                      className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-wait ${
                        active
                          ? 'border-transparent text-gray-800 shadow-sm'
                          : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                      style={
                        active
                          ? { backgroundColor: `${label.color}1f` }
                          : undefined
                      }
                    >
                      {active ? (
                        <Check className="h-3 w-3" aria-hidden="true" />
                      ) : (
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: label.color }}
                          aria-hidden="true"
                        />
                      )}
                      <span className="max-w-[9rem] truncate">{label.name}</span>
                    </button>
                  );
                })}

                {(board.labels ?? []).length === 0 && (
                  <p className="text-xs text-gray-500">
                    No labels on this board yet.
                  </p>
                )}
              </div>
            </section>

            <section aria-labelledby="danger-heading" className="pt-1">
              <h3 id="danger-heading" className="sr-only">
                Card actions
              </h3>
              {confirmingDelete ? (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                  <p className="text-xs font-medium text-red-800">
                    Delete this card permanently?
                  </p>
                  <p className="mt-1 text-[11px] leading-4 text-red-700">
                    Its checklist and comments will be removed too.
                  </p>
                  <div className="mt-2.5 flex gap-2">
                    <button
                      type="button"
                      onClick={handleDeleteCard}
                      disabled={deleteCard.isPending}
                      className="inline-flex items-center justify-center gap-1 rounded-md bg-red-600 px-2.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 disabled:cursor-wait disabled:bg-red-300"
                    >
                      {deleteCard.isPending && (
                        <Loader2
                          className="h-3 w-3 animate-spin"
                          aria-hidden="true"
                        />
                      )}
                      Delete
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmingDelete(false)}
                      className="rounded-md bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(true)}
                  className="inline-flex w-full items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-gray-500 transition-colors hover:bg-red-50 hover:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  Delete card
                </button>
              )}
            </section>
          </aside>
        </div>
      </div>
    </div>
  );

  if (!isOverlay) {
    return panel;
  }

  return (
    <div
      className="animate-card-overlay fixed inset-0 z-50 overflow-y-auto bg-gray-950/50 px-3 py-4 sm:px-6 sm:py-8"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="mx-auto flex min-h-full w-full max-w-4xl items-start justify-center">
        {panel}
      </div>
    </div>
  );
}
