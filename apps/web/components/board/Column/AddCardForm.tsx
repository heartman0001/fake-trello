'use client';

import { useState } from 'react';
import { X } from 'lucide-react';

interface AddCardFormProps {
  onAddCard: (title: string) => void;
  onCancel: () => void;
}

export default function AddCardForm({ onAddCard, onCancel }: AddCardFormProps) {
  const [title, setTitle] = useState('');

  const submit = () => {
    const trimmed = title.trim();
    if (!trimmed) return;
    onAddCard(trimmed);
    setTitle('');
  };

  return (
    <div className="rounded-md border border-gray-200 bg-white p-2 shadow-sm">
      <textarea
        autoFocus
        rows={2}
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            submit();
          }
          if (event.key === 'Escape') onCancel();
        }}
        placeholder="Enter a title for this card…"
        className="w-full resize-none rounded border border-gray-200 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      />
      <div className="mt-2 flex items-center gap-2">
        <button
          onClick={submit}
          disabled={!title.trim()}
          className="btn-primary px-3 py-1.5"
        >
          Add card
        </button>
        <button
          onClick={onCancel}
          className="rounded p-1.5 text-gray-500 hover:bg-gray-100"
          aria-label="Cancel adding card"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
