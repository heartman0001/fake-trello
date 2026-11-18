'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { CardWithRelations } from '@fake-trello/shared';
import { useUpdateCardDetails } from './useBoardQueries';

export type AutosaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

const AUTOSAVE_DELAY_MS = 500;

interface AutosaveState {
  title: string;
  description: string;
}

/**
 * Debounced (500ms) auto-save for a card's title and description.
 *
 * Saves are serialized: edits made while a request is in flight schedule one
 * follow-up save with the latest draft, so a slower earlier response can never
 * overwrite newer text.
 */
export function useCardAutosave(
  boardId: string,
  card: CardWithRelations,
) {
  const updateCard = useUpdateCardDetails(boardId);

  const [title, setTitleState] = useState(card.title);
  const [description, setDescriptionState] = useState(card.description ?? '');
  const [status, setStatus] = useState<AutosaveStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  const savedRef = useRef<AutosaveState>({
    title: card.title,
    description: card.description ?? '',
  });
  const draftRef = useRef<AutosaveState>({
    title: card.title,
    description: card.description ?? '',
  });
  const timerRef = useRef<number | null>(null);
  const inFlightRef = useRef(false);
  const rerunRef = useRef(false);
  const cardIdRef = useRef(card.id);
  const flushRef = useRef<() => Promise<void>>(async () => undefined);

  cardIdRef.current = card.id;

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const schedule = useCallback(() => {
    clearTimer();
    setStatus('pending');
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      void flushRef.current();
    }, AUTOSAVE_DELAY_MS);
  }, [clearTimer]);

  const setTitle = useCallback(
    (value: string) => {
      draftRef.current = { ...draftRef.current, title: value };
      setTitleState(value);
      schedule();
    },
    [schedule],
  );

  const setDescription = useCallback(
    (value: string) => {
      draftRef.current = { ...draftRef.current, description: value };
      setDescriptionState(value);
      schedule();
    },
    [schedule],
  );

  const flush = useCallback(async () => {
    clearTimer();
    if (inFlightRef.current) {
      rerunRef.current = true;
      return;
    }

    const current = draftRef.current;
    const trimmedTitle = current.title.trim();
    const data: { title?: string; description?: string } = {};

    if (trimmedTitle && trimmedTitle !== savedRef.current.title) {
      data.title = trimmedTitle;
    }
    if (current.description !== savedRef.current.description) {
      data.description = current.description;
    }
    if (data.title === undefined && data.description === undefined) {
      setStatus((previous) => (previous === 'saved' ? 'saved' : 'idle'));
      return;
    }

    const requestCardId = cardIdRef.current;
    inFlightRef.current = true;
    setStatus('saving');
    setError(null);

    try {
      await updateCard.mutateAsync({ cardId: requestCardId, data });

      if (cardIdRef.current !== requestCardId) return;

      savedRef.current = {
        title: data.title ?? savedRef.current.title,
        description: data.description ?? savedRef.current.description,
      };

      const settled = draftRef.current;
      const isClean =
        settled.title.trim() === savedRef.current.title &&
        settled.description === savedRef.current.description;

      if (isClean) {
        setStatus('saved');
      } else {
        rerunRef.current = true;
      }
    } catch (err) {
      if (cardIdRef.current === requestCardId) {
        setStatus('error');
        setError(
          err instanceof Error ? err.message : 'Could not save changes.',
        );
      }
    } finally {
      inFlightRef.current = false;
      if (rerunRef.current) {
        rerunRef.current = false;
        void flushRef.current();
      }
    }
  }, [clearTimer, updateCard.mutateAsync]);

  flushRef.current = flush;

  const flushNow = useCallback(() => {
    void flushRef.current();
  }, []);

  const handleTitleBlur = useCallback(() => {
    const trimmed = draftRef.current.title.trim();

    if (!trimmed) {
      const savedTitle = savedRef.current.title;
      draftRef.current = { ...draftRef.current, title: savedTitle };
      setTitleState(savedTitle);
      clearTimer();

      if (draftRef.current.description !== savedRef.current.description) {
        void flushRef.current();
      } else {
        setStatus('saved');
      }
      return;
    }

    if (trimmed !== draftRef.current.title) {
      draftRef.current = { ...draftRef.current, title: trimmed };
      setTitleState(trimmed);
    }

    void flushRef.current();
  }, [clearTimer]);

  const handleDescriptionBlur = useCallback(() => {
    void flushRef.current();
  }, []);

  // Adopt realtime/server updates for fields the local user has not edited.
  useEffect(() => {
    const previousSaved = savedRef.current;
    const incoming: AutosaveState = {
      title: card.title,
      description: card.description ?? '',
    };
    savedRef.current = incoming;

    const draft = draftRef.current;
    const next: AutosaveState = {
      title:
        draft.title === previousSaved.title ? incoming.title : draft.title,
      description:
        draft.description === previousSaved.description
          ? incoming.description
          : draft.description,
    };

    if (next.title !== draft.title) {
      setTitleState(next.title);
    }
    if (next.description !== draft.description) {
      setDescriptionState(next.description);
    }
    draftRef.current = next;
  }, [card.title, card.description]);

  // Reset the draft when navigating to a different card.
  useEffect(() => {
    const initial: AutosaveState = {
      title: card.title,
      description: card.description ?? '',
    };

    clearTimer();
    savedRef.current = initial;
    draftRef.current = initial;
    rerunRef.current = false;
    setTitleState(initial.title);
    setDescriptionState(initial.description);
    setStatus('idle');
    setError(null);
    // Only the identity of the card should reset the editor; subsequent server
    // updates are handled by the adoption effect above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card.id, clearTimer]);

  // Flush a pending debounce if the modal unmounts (back button, close, route
  // change) so the last keystrokes are not lost.
  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
        void flushRef.current();
      }
    };
  }, []);

  return {
    title,
    description,
    status,
    error,
    setTitle,
    setDescription,
    handleTitleBlur,
    handleDescriptionBlur,
    flushNow,
  };
}
