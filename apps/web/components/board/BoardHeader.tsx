'use client';

import { useEffect, useId, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, BarChart3, SlidersHorizontal, X } from 'lucide-react';
import type { BoardMember, Label } from '@fake-trello/shared';
import Select from '@/components/ui/Select';

export interface BoardFilters {
  search: string;
  labelId: string;
  due: 'all' | 'overdue' | 'today' | 'week';
}

export const EMPTY_BOARD_FILTERS: BoardFilters = {
  search: '',
  labelId: '',
  due: 'all',
};

interface BoardHeaderProps {
  boardId: string;
  boardTitle: string;
  workspaceName?: string;
  members?: BoardMember[];
  labels?: Label[];
  columnCount: number;
  cardCount: number;
  visibleCardCount: number;
  filters: BoardFilters;
  onFiltersChange: (filters: BoardFilters) => void;
}

const MAX_VISIBLE_MEMBERS = 4;

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function MemberAvatars({ members }: { members: BoardMember[] }) {
  if (members.length === 0) return null;

  const visible = members.slice(0, MAX_VISIBLE_MEMBERS);
  const overflow = members.length - visible.length;

  return (
    <ul
      className="hidden -space-x-1.5 sm:flex"
      aria-label={`${members.length} board member${members.length !== 1 ? 's' : ''}`}
    >
      {visible.map((member) => (
        <li key={member.id}>
          <span
            className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-[10px] font-semibold uppercase text-white ring-2 ring-white"
            title={`${member.user.name} · ${member.role.toLowerCase()}`}
          >
            <span className="sr-only">
              {member.user.name}, {member.role.toLowerCase()}
            </span>
            <span aria-hidden="true">{getInitials(member.user.name)}</span>
          </span>
        </li>
      ))}
      {overflow > 0 && (
        <li>
          <span
            className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-100 text-[10px] font-semibold text-gray-600 ring-2 ring-white tabular-nums"
            title={`${overflow} more member${overflow !== 1 ? 's' : ''}`}
          >
            <span className="sr-only">
              {overflow} more member{overflow !== 1 ? 's' : ''}
            </span>
            <span aria-hidden="true">+{overflow}</span>
          </span>
        </li>
      )}
    </ul>
  );
}

export default function BoardHeader({
  boardId,
  boardTitle,
  workspaceName,
  members = [],
  labels = [],
  columnCount,
  cardCount,
  visibleCardCount,
  filters,
  onFiltersChange,
}: BoardHeaderProps) {
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const searchId = useId();
  const labelFilterId = useId();
  const dueFilterId = useId();
  const panelId = useId();

  const hasFilters =
    filters.search.trim() !== '' ||
    filters.labelId !== '' ||
    filters.due !== 'all';

  const activeFilterCount =
    (filters.search.trim() ? 1 : 0) +
    (filters.labelId ? 1 : 0) +
    (filters.due !== 'all' ? 1 : 0);

  useEffect(() => {
    if (!isFilterOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsFilterOpen(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFilterOpen]);

  const update = (patch: Partial<BoardFilters>) =>
    onFiltersChange({ ...filters, ...patch });

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-gray-200 bg-white px-4 sm:gap-3 sm:px-6">
      <Link
        href="/workspaces"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
        aria-label="Back to workspaces"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      </Link>

      <div className="min-w-0 flex-1">
        <h1 className="truncate text-base font-semibold tracking-tight text-gray-900 sm:text-lg">
          {boardTitle}
        </h1>
        <p className="truncate text-xs text-gray-500">
          {workspaceName ? `${workspaceName} · ` : ''}
          {columnCount} column{columnCount !== 1 ? 's' : ''} ·{' '}
          {hasFilters ? (
            <span className="tabular-nums">
              {visibleCardCount} of {cardCount} cards
            </span>
          ) : (
            <span className="tabular-nums">
              {cardCount} card{cardCount !== 1 ? 's' : ''}
            </span>
          )}
        </p>
      </div>

      <MemberAvatars members={members} />

      <div className="flex shrink-0 items-center gap-2">
        <Link
          href={`/board/${boardId}/analytics`}
          className="inline-flex h-9 items-center gap-2 rounded-md border border-gray-200 bg-white px-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 sm:px-3"
          aria-label="Open board analytics"
        >
          <BarChart3 className="h-4 w-4" aria-hidden="true" />
          <span className="hidden sm:inline">Analytics</span>
        </Link>

        <div className="relative">
          <button
            type="button"
            onClick={() => setIsFilterOpen((open) => !open)}
            className="relative inline-flex h-9 items-center gap-2 rounded-md border border-gray-200 bg-white px-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 sm:px-3"
            aria-expanded={isFilterOpen}
            aria-controls={panelId}
            aria-label={isFilterOpen ? 'Close board filters' : 'Open board filters'}
          >
            <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">Filter</span>
            {activeFilterCount > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-600 px-1 text-[11px] font-semibold text-white tabular-nums">
                {activeFilterCount}
              </span>
            )}
          </button>

          {isFilterOpen && (
            <>
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setIsFilterOpen(false)}
                className="fixed inset-0 z-40 cursor-default"
                aria-label="Close filters"
              />
              <div
                id={panelId}
                role="group"
                aria-label="Filter cards"
                className="absolute right-0 top-full z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-gray-200 bg-white p-4 shadow-lg"
              >
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-gray-900">
                    Filter cards
                  </h2>
                  <button
                    type="button"
                    onClick={() => setIsFilterOpen(false)}
                    className="rounded p-1 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                    aria-label="Close filters"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>

                <div className="space-y-3">
                  <div>
                    <label
                      htmlFor={searchId}
                      className="mb-1 block text-xs font-medium text-gray-700"
                    >
                      Search cards
                    </label>
                    <input
                      id={searchId}
                      type="search"
                      name="board-card-search"
                      autoComplete="off"
                      value={filters.search}
                      onChange={(event) =>
                        update({ search: event.target.value })
                      }
                      placeholder="Search title or description…"
                      className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label
                        htmlFor={labelFilterId}
                        className="mb-1 block text-xs font-medium text-gray-700"
                      >
                        Label
                      </label>
                      <Select
                        id={labelFilterId}
                        name="board-label-filter"
                        value={filters.labelId}
                        onChange={(labelId) => update({ labelId })}
                        options={[
                          { value: '', label: 'All labels' },
                          ...labels.map((label) => ({
                            value: label.id,
                            label: label.name,
                            color: label.color,
                          })),
                        ]}
                      />
                    </div>

                    <div>
                      <label
                        htmlFor={dueFilterId}
                        className="mb-1 block text-xs font-medium text-gray-700"
                      >
                        Due date
                      </label>
                      <Select
                        id={dueFilterId}
                        name="board-due-filter"
                        value={filters.due}
                        onChange={(due) =>
                          update({ due: due as BoardFilters['due'] })
                        }
                        options={[
                          { value: 'all', label: 'All dates' },
                          { value: 'overdue', label: 'Overdue' },
                          { value: 'today', label: 'Due today' },
                          { value: 'week', label: 'Next 7 days' },
                        ]}
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-3">
                  <button
                    type="button"
                    onClick={() => onFiltersChange(EMPTY_BOARD_FILTERS)}
                    disabled={!hasFilters}
                    className="rounded-md px-2 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:text-gray-400 disabled:hover:bg-transparent"
                  >
                    Clear filters
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsFilterOpen(false)}
                    className="rounded-md px-3 py-1.5 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  >
                    Done
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
