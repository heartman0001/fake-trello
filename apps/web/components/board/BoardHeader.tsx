'use client';

import { useEffect, useId, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  BarChart3,
  SlidersHorizontal,
  Trash2,
  X,
  UserPlus,
  XCircle,
} from 'lucide-react';
import type { BoardMember, Label } from '@fake-trello/shared';
import Select from '@/components/ui/Select';
import { useAddBoardMember, useInviteCandidates, useRemoveBoardMember } from '@/hooks/useBoardQueries';
import { usePreferences } from '@/lib/preferences';

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
  memberRole?: 'OWNER' | 'ADMIN' | 'MEMBER';
  workspaceId?: string;
  onDeleteBoard?: () => void;
}

const MAX_VISIBLE_MEMBERS = 4;

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function MemberAvatars({ members }: { members: BoardMember[] }) {
  const { t } = usePreferences();
  if (members.length === 0) return null;

  const visible = members.slice(0, MAX_VISIBLE_MEMBERS);
  const overflow = members.length - visible.length;

  return (
    <ul
      className="hidden -space-x-1.5 sm:flex"
      aria-label={t(
        members.length === 1 ? 'memberCountLabel' : 'memberCountLabelPlural',
        { count: members.length },
      )}
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
  memberRole = 'MEMBER',
  workspaceId,
  onDeleteBoard,
}: BoardHeaderProps) {
  const { t } = usePreferences();
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isMembersDropdownOpen, setIsMembersDropdownOpen] = useState(false);
  const [searchId] = useState(useId());
  const [labelFilterId] = useState(useId());
  const [dueFilterId] = useState(useId());
  const [panelId] = useState(useId());
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [selectedRole, setSelectedRole] = useState<'ADMIN' | 'MEMBER'>('ADMIN');
  const [error, setError] = useState<string | null>(null);

  // Member management hooks
  const usersQuery = useInviteCandidates(
    boardId,
    debouncedSearch,
    isInviteModalOpen,
  );
  const addMember = useAddBoardMember(boardId);
  const removeMember = useRemoveBoardMember(boardId);

  const inviteCandidates = (usersQuery.data?.pages ?? [])
    .flatMap((page) => page.items)
    .filter((user) => !members.some((member) => member.user.id === user.id));

  const hasFilters =
    filters.search.trim() !== '' ||
    filters.labelId !== '' ||
    filters.due !== 'all';

  const activeFilterCount =
    (filters.search.trim() ? 1 : 0) +
    (filters.labelId ? 1 : 0) +
    (filters.due !== 'all' ? 1 : 0);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    if (!isFilterOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsFilterOpen(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFilterOpen]);

  const update = (patch: Partial<BoardFilters>) => {
    onFiltersChange({ ...filters, ...patch });
  };

  // Handle invite member
  const handleInvite = () => {
    if (!selectedUserId) return;
    addMember.mutate(
      { userId: selectedUserId, role: selectedRole },
      {
        onSuccess: () => {
          setSelectedUserId('');
          setSearchQuery('');
          setIsInviteModalOpen(false);
          setError(null);
        },
        onError: (err: Error) => setError(err.message),
      },
    );
  };

  // Handle remove member
  const handleRemove = (memberId: string) => {
    removeMember.mutate(memberId, {
      onError: (err: Error) => setError(err.message),
    });
  };

  return (
    <header className="sticky top-0 z-30 flex min-h-16 flex-wrap items-center gap-2 border-b border-gray-200 bg-white px-4 py-2 sm:h-16 sm:flex-nowrap sm:gap-3 sm:px-6 sm:py-0">
      <Link
        href="/workspaces"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
        aria-label={t('backToWorkspaces')}
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      </Link>

      <div className="min-w-0 flex-1">
        <h1 className="truncate text-base font-semibold tracking-tight text-gray-900 sm:text-lg">
          {boardTitle}
        </h1>
        <p className="truncate text-xs text-gray-500">
          {workspaceName ? `${workspaceName} · ` : ''}
          {t(columnCount === 1 ? 'columnCount' : 'columnCountPlural', {
            count: columnCount,
          })}{' '}
          ·{' '}
          {hasFilters ? (
            <span className="tabular-nums">
              {t('visibleCards', {
                visible: visibleCardCount,
                total: cardCount,
              })}
            </span>
          ) : (
            <span className="tabular-nums">
              {t(cardCount === 1 ? 'cardCount' : 'cardCountPlural', {
                count: cardCount,
              })}
            </span>
          )}
        </p>
      </div>

      <MemberAvatars members={members} />

      <div className="flex w-full shrink-0 flex-wrap items-center justify-end gap-2 sm:w-auto sm:flex-nowrap">
        <Link
          href={`/board/${boardId}/analytics`}
          className="inline-flex h-9 items-center gap-2 rounded-md border border-gray-200 bg-white px-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 sm:px-3"
          aria-label={t('openAnalytics')}
        >
          <BarChart3 className="h-4 w-4" aria-hidden="true" />
          <span className="hidden sm:inline">{t('analytics')}</span>
        </Link>

        <div className="relative">
          <button
            type="button"
            onClick={() => setIsFilterOpen((open) => !open)}
            className="relative inline-flex h-9 items-center gap-2 rounded-md border border-gray-200 bg-white px-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 sm:px-3"
            aria-expanded={isFilterOpen}
            aria-controls={panelId}
            aria-label={
              isFilterOpen ? t('closeBoardFilters') : t('openBoardFilters')
            }
          >
            <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">{t('filter')}</span>
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
                aria-label={t('closeFilters')}
              />
              <div
                id={panelId}
                role="group"
                aria-label={t('filterCards')}
                className="absolute right-0 top-full z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-gray-200 bg-white p-4 shadow-lg"
              >
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-gray-900">
                    {t('filterCards')}
                  </h2>
                  <button
                    type="button"
                    onClick={() => setIsFilterOpen(false)}
                    className="rounded p-1 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                    aria-label={t('closeFilters')}
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
                      {t('searchCards')}
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
                      placeholder={t('searchCardsPlaceholder')}
                      className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label
                        htmlFor={labelFilterId}
                        className="mb-1 block text-xs font-medium text-gray-700"
                      >
                        {t('label')}
                      </label>
                      <Select
                        id={labelFilterId}
                        name="board-label-filter"
                        value={filters.labelId}
                        onChange={(labelId) => update({ labelId })}
                        options={[
                          { value: '', label: t('allLabels') },
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
                        {t('dueDate')}
                      </label>
                      <Select
                        id={dueFilterId}
                        name="board-due-filter"
                        value={filters.due}
                        onChange={(due) =>
                          update({ due: due as BoardFilters['due'] })
                        }
                        options={[
                          { value: 'all', label: t('allDates') },
                          { value: 'overdue', label: t('overdue') },
                          { value: 'today', label: t('dueToday') },
                          { value: 'week', label: t('next7Days') },
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
                    {t('clearFilters')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsFilterOpen(false)}
                    className="rounded-md px-3 py-1.5 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  >
                    {t('done')}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Members Dropdown */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsMembersDropdownOpen(!isMembersDropdownOpen)}
          className="relative inline-flex h-9 items-center gap-2 rounded-md border border-gray-200 bg-white px-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 sm:px-3"
          aria-expanded={isMembersDropdownOpen}
          aria-label={t('boardMembers')}
        >
          <div className="flex -space-x-1.5">
            {members.slice(0, 3).map((member) => (
              <span
                key={member.id}
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-600 text-[8px] font-semibold uppercase text-white ring-2 ring-white"
                title={member.user.name + ' · ' + member.role.toLowerCase()}
              >
                <span aria-hidden="true">{getInitials(member.user.name)}</span>
              </span>
            ))}
            {members.length > 3 && (
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gray-100 text-[8px] font-semibold text-gray-600 ring-2 ring-white">
                <span aria-hidden="true">+{members.length - 3}</span>
              </span>
            )}
          </div>
        </button>

        {isMembersDropdownOpen && (
          <>
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setIsMembersDropdownOpen(false)}
              className="fixed inset-0 z-40 cursor-default"
              aria-label={t('close')}
            />
            <div
              data-members-panel="members-panel"
              className="absolute right-0 top-full z-50 mt-2 w-[min(20rem,calc(100vw-2rem))] rounded-lg border border-gray-200 bg-white p-4 shadow-lg"
            >
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-900">
                  {t('members')} ({members.length})
                </h2>
                {(memberRole === 'OWNER' || memberRole === 'ADMIN') && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsMembersDropdownOpen(false);
                      setIsInviteModalOpen(true);
                    }}
                    className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700"
                  >
                    <UserPlus className="h-3 w-3" />
                    {t('invite')}
                  </button>
                )}
              </div>

              {members.length === 0 ? (
                <p className="text-xs text-gray-500">{t('noMembersYet')}</p>
              ) : (
                <ul className="space-y-1">
                  {members.map((member) => (
                    <li
                      key={member.id}
                      className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-gray-50"
                    >
                      <div className="flex items-center gap-2">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-medium text-gray-700">
                          {getInitials(member.user.name)}
                        </span>
                        <span className="text-sm text-gray-900">
                          {member.user.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-medium uppercase text-gray-500">
                          {member.role.toLowerCase()}
                        </span>
                        {(memberRole === 'OWNER' || memberRole === 'ADMIN') &&
                          member.role !== 'OWNER' && (
                            <button
                              type="button"
                              onClick={() => handleRemove(member.userId)}
                              className="text-gray-400 hover:text-red-600"
                              title={t('removeMember')}
                            >
                              <XCircle className="h-4 w-4" />
                            </button>
                          )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </div>

      {onDeleteBoard &&
        (memberRole === 'OWNER' || memberRole === 'ADMIN') && (
          <button
            type="button"
            onClick={onDeleteBoard}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-500 transition-colors hover:border-red-300 hover:bg-red-50 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
            aria-label={t('deleteBoard')}
            title={t('deleteBoard')}
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </button>
        )}

      {/* Invite Member Modal */}
      {isInviteModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          data-invite-modal="invite-modal"
          onClick={() => setIsInviteModalOpen(false)}
        >
          <div
            className="relative w-full max-w-md rounded-lg border border-gray-200 bg-white p-4 shadow-xl sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setIsInviteModalOpen(false)}
              className="absolute right-3 top-3 rounded-md p-1 text-gray-400 hover:text-gray-600"
              aria-label={t('close')}
            >
              <X className="h-5 w-5" />
            </button>

            <h2 className="mb-4 text-lg font-semibold text-gray-900">
              {t('inviteMember')}
            </h2>

            {error && (
              <div
                role="alert"
                className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
              >
                {error}
              </div>
            )}

            <div className="mb-4">
              <label className="mb-2 block text-sm font-medium text-gray-700">
                {t('selectUser')}
              </label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('searchUsers')}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* User List */}
            <div className="mb-4 max-h-48 overflow-y-auto">
              {searchQuery.trim().length === 1 ? (
                <p className="text-sm text-gray-500">
                  {t('searchUsersHint')}
                </p>
              ) : usersQuery.isLoading ? (
                <p className="text-sm text-gray-500">{t('loadingUsers')}</p>
              ) : inviteCandidates.length > 0 ? (
                <ul className="space-y-1">
                  {inviteCandidates.map((user) => (
                    <li
                      key={user.id}
                      className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-gray-50"
                      style={{ cursor: 'pointer' }}
                      onClick={() => setSelectedUserId(user.id)}
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-medium text-gray-700">
                          {getInitials(user.name)}
                        </span>
                        <span className="flex min-w-0 flex-col">
                          <span className="truncate text-sm text-gray-900">
                            {user.name}
                          </span>
                          <span className="truncate text-xs text-gray-500">
                            {user.email}
                          </span>
                        </span>
                      </div>
                      {selectedUserId === user.id && (
                        <span className="text-xs text-blue-600">✓</span>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-500">
                  {debouncedSearch.trim()
                    ? t('noUsersMatch')
                    : t('noUsersAvailable')}
                </p>
              )}

              {usersQuery.hasNextPage &&
                searchQuery.trim().length !== 1 && (
                  <button
                    type="button"
                    onClick={() => usersQuery.fetchNextPage()}
                    disabled={usersQuery.isFetchingNextPage}
                    className="mt-2 w-full rounded-md border border-gray-200 px-3 py-1.5 text-xs font-medium text-blue-600 transition-colors hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-wait disabled:text-gray-400"
                  >
                    {usersQuery.isFetchingNextPage
                      ? t('loading')
                      : t('loadMore')}
                  </button>
                )}
            </div>

            <div className="mb-4">
              <label className="mb-2 block text-sm font-medium text-gray-700">
                {t('role')}
              </label>
              <Select
                value={selectedRole}
                onChange={(role) => setSelectedRole(role as 'ADMIN' | 'MEMBER')}
                options={[
                  { value: 'ADMIN', label: t('admin') },
                  { value: 'MEMBER', label: t('member') },
                ]}
              />
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setIsInviteModalOpen(false)}
                className="flex-1 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                onClick={handleInvite}
                disabled={!selectedUserId}
                className="flex-1 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-300"
              >
                {t('invite')}
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </header>
  );
}
