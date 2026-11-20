'use client';

import { useEffect, useId, useRef } from 'react';
import { AlertCircle, Trash2 } from 'lucide-react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  summary?: React.ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  pendingLabel?: string;
  isPending?: boolean;
  error?: string | null;
  tone?: 'danger' | 'default';
  onConfirm: () => void;
  onClose: () => void;
}

export default function ConfirmDialog({
  open,
  title,
  description,
  summary,
  confirmLabel,
  cancelLabel = 'Cancel',
  pendingLabel = 'Working…',
  isPending = false,
  error = null,
  tone = 'danger',
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const previousOverflowRef = useRef<string | null>(null);
  const titleId = useId();
  const descriptionId = useId();
  const summaryId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      previousOverflowRef.current = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      dialog.showModal();
      cancelRef.current?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
      if (previousOverflowRef.current !== null) {
        document.body.style.overflow = previousOverflowRef.current;
        previousOverflowRef.current = null;
      }
    }
  }, [open]);

  useEffect(
    () => () => {
      const dialog = dialogRef.current;
      if (dialog?.open) dialog.close();
      if (previousOverflowRef.current !== null) {
        document.body.style.overflow = previousOverflowRef.current;
      }
    },
    [],
  );

  useEffect(() => {
    if (!open) return;

    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleTab = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;

      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => element.getClientRects().length > 0);

      if (focusable.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const activeElement = document.activeElement;
      const focusIsOutside =
        activeElement === dialog || !dialog.contains(activeElement);

      if (event.shiftKey) {
        if (activeElement === first || focusIsOutside) {
          event.preventDefault();
          last.focus();
        }
      } else if (activeElement === last || focusIsOutside) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleTab, true);
    return () => document.removeEventListener('keydown', handleTab, true);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    if (isPending) {
      dialogRef.current?.focus();
    } else {
      cancelRef.current?.focus();
    }
  }, [isPending, open]);

  const handleCancel = (event: React.SyntheticEvent<HTMLDialogElement>) => {
    event.preventDefault();
    if (!isPending) onClose();
  };

  const handleDialogClick = (event: React.MouseEvent<HTMLDialogElement>) => {
    if (isPending || event.target !== event.currentTarget) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const clickedOutside =
      event.clientX < rect.left ||
      event.clientX > rect.right ||
      event.clientY < rect.top ||
      event.clientY > rect.bottom;

    if (clickedOutside) onClose();
  };

  const isDanger = tone === 'danger';
  const Icon = isDanger ? Trash2 : AlertCircle;

  return (
    <dialog
      ref={dialogRef}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={
        summary ? `${descriptionId} ${summaryId}` : descriptionId
      }
      aria-busy={isPending}
      tabIndex={-1}
      onCancel={handleCancel}
      onClick={handleDialogClick}
      className="confirm-dialog m-auto max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-md overflow-y-auto rounded-xl border border-gray-200 bg-white p-0 text-left text-gray-900 shadow-[0_24px_80px_-24px_rgba(15,23,42,0.5)] outline-none"
    >
      <div className="animate-card-panel p-5">
        <div className="flex items-start gap-3">
          <span
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
              isDanger
                ? 'bg-red-50 text-red-600'
                : 'bg-blue-50 text-blue-600'
            }`}
            aria-hidden="true"
          >
            <Icon className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2
              id={titleId}
              className="text-lg font-semibold tracking-[-0.01em] text-gray-900"
            >
              {title}
            </h2>
            <p
              id={descriptionId}
              className="mt-1 text-sm leading-relaxed text-gray-600"
            >
              {description}
            </p>
          </div>
        </div>

        {summary && (
          <div
            id={summaryId}
            className="mt-4 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600"
          >
            {summary}
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            {error}
          </div>
        )}

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            ref={cancelRef}
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className={`inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed ${
              isDanger
                ? 'bg-red-600 hover:bg-red-700 focus-visible:ring-red-500 disabled:bg-red-300'
                : 'bg-blue-600 hover:bg-blue-700 focus-visible:ring-blue-500 disabled:bg-blue-300'
            }`}
          >
            {isPending ? pendingLabel : confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
