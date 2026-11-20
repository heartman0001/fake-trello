'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  LayoutGrid,
  Pencil,
  Plus,
  Settings,
  Trash2,
  Users,
} from 'lucide-react';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import UserAvatar from '@/components/ui/UserAvatar';
import { api } from '@/lib/api';
import { usePreferences } from '@/lib/preferences';
import { useAuthStore } from '@/store/useAuthStore';
import type { BoardSummary, WorkspaceSummary } from '@/types';

export default function WorkspacesPage() {
  const queryClient = useQueryClient();
  const { t } = usePreferences();
  const user = useAuthStore((state) => state.user);

  const [showWorkspaceForm, setShowWorkspaceForm] = useState(false);
  const [workspaceName, setWorkspaceName] = useState('');
  const [editingWorkspaceId, setEditingWorkspaceId] = useState<string | null>(
    null,
  );
  const [editWorkspaceName, setEditWorkspaceName] = useState('');
  const [editWorkspaceDescription, setEditWorkspaceDescription] = useState('');
  const [boardFormWorkspaceId, setBoardFormWorkspaceId] = useState<
    string | null
  >(null);
  const [boardTitle, setBoardTitle] = useState('');
  const [workspaceToDelete, setWorkspaceToDelete] =
    useState<WorkspaceSummary | null>(null);
  const [deleteWorkspaceError, setDeleteWorkspaceError] = useState<
    string | null
  >(null);
  const [error, setError] = useState<string | null>(null);

  const workspacesQuery = useQuery({
    queryKey: ['workspaces'],
    queryFn: () => api.get<WorkspaceSummary[]>('/workspaces'),
  });

  const boardsQuery = useQuery({
    queryKey: ['boards'],
    queryFn: () => api.get<BoardSummary[]>('/boards'),
  });

  const createWorkspace = useMutation({
    mutationFn: (name: string) =>
      api.post<WorkspaceSummary>('/workspaces', { name }),
    onSuccess: () => {
      setError(null);
      setWorkspaceName('');
      setShowWorkspaceForm(false);
      queryClient.invalidateQueries({ queryKey: ['workspaces'] });
    },
    onError: (err) => setError(err.message),
  });

  const deleteWorkspace = useMutation({
    mutationFn: (workspace: WorkspaceSummary) =>
      api.delete(`/workspaces/${workspace.id}`),
    onSuccess: (_, workspace) => {
      setError(null);
      setWorkspaceToDelete(null);
      setDeleteWorkspaceError(null);
      queryClient.removeQueries({
        queryKey: ['workspace-management', workspace.id],
      });
      queryClient.invalidateQueries({ queryKey: ['workspaces'] });
      queryClient.invalidateQueries({ queryKey: ['boards'] });
    },
    onError: (err) => setDeleteWorkspaceError(err.message),
  });

  const updateWorkspace = useMutation({
    mutationFn: ({
      id,
      name,
      description,
    }: {
      id: string;
      name: string;
      description: string;
    }) =>
      api.put<WorkspaceSummary>(`/workspaces/${id}`, {
        name,
        description,
      }),
    onSuccess: (_, { id }) => {
      setError(null);
      setEditingWorkspaceId(null);
      queryClient.invalidateQueries({ queryKey: ['workspaces'] });
      queryClient.invalidateQueries({ queryKey: ['boards'] });
      queryClient.invalidateQueries({
        queryKey: ['workspace-management', id],
      });
    },
    onError: (err) => setError(err.message),
  });

  const createBoard = useMutation({
    mutationFn: ({ workspaceId, title }: { workspaceId: string; title: string }) =>
      api.post<BoardSummary>('/boards', { workspaceId, title }),
    onSuccess: () => {
      setError(null);
      setBoardTitle('');
      setBoardFormWorkspaceId(null);
      queryClient.invalidateQueries({ queryKey: ['boards'] });
      queryClient.invalidateQueries({ queryKey: ['workspaces'] });
    },
    onError: (err) => setError(err.message),
  });

  const workspaces = workspacesQuery.data ?? [];
  const boards = boardsQuery.data ?? [];
  const isLoading = workspacesQuery.isLoading || boardsQuery.isLoading;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-sm font-bold text-white">
              FT
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-lg font-semibold text-gray-900">
                {t('workspaces')}
              </h1>
              {user && (
                <p className="truncate text-xs text-gray-500">
                  {t('signedInAs', { name: user.name })}
                </p>
              )}
            </div>
          </div>
          <Link
            href="/settings"
            className="btn-secondary shrink-0"
            aria-label={t('settings')}
          >
            {user && (
              <UserAvatar
                name={user.name}
                avatarUrl={user.avatarUrl}
                size="xs"
                className="ring-0"
              />
            )}
            <Settings className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">{t('settings')}</span>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-xl font-semibold text-gray-900">
            {t('yourWork')}
          </h2>
          <button
            onClick={() => setShowWorkspaceForm((value) => !value)}
            className="btn-primary w-full sm:w-auto"
          >
            <Plus className="h-4 w-4" />
            {t('newWorkspace')}
          </button>
        </div>

        {error && (
          <p role="alert" className="mb-4 text-sm text-red-600">
            {error}
          </p>
        )}

        {showWorkspaceForm && (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (workspaceName.trim()) {
                createWorkspace.mutate(workspaceName.trim());
              }
            }}
            className="card-surface mb-6 flex flex-col gap-3 p-4 sm:flex-row"
          >
            <input
              autoFocus
              value={workspaceName}
              onChange={(event) => setWorkspaceName(event.target.value)}
              placeholder={t('workspaceName')}
              className="field flex-1"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowWorkspaceForm(false)}
                className="btn-secondary"
              >
                {t('cancel')}
              </button>
              <button
                type="submit"
                disabled={!workspaceName.trim() || createWorkspace.isPending}
                className="btn-primary"
              >
                {t('create')}
              </button>
            </div>
          </form>
        )}

        {isLoading ? (
          <div className="grid gap-6 md:grid-cols-2">
            {[0, 1].map((key) => (
              <div
                key={key}
                className="h-48 animate-pulse rounded-lg bg-gray-200"
              />
            ))}
          </div>
        ) : workspaces.length === 0 ? (
          <div className="card-surface flex flex-col items-center justify-center px-6 py-16 text-center">
            <LayoutGrid className="mb-3 h-10 w-10 text-gray-400" />
            <h3 className="text-base font-medium text-gray-900">
              {t('noWorkspacesYet')}
            </h3>
            <p className="mt-1 max-w-sm text-sm text-gray-500">
              {t('noWorkspacesDescription')}
            </p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {workspaces.map((workspace) => {
              const workspaceBoards = boards.filter(
                (board) => board.workspaceId === workspace.id,
              );

              return (
                <section key={workspace.id} className="card-surface p-5">
                  {editingWorkspaceId === workspace.id ? (
                    <form
                      onSubmit={(event) => {
                        event.preventDefault();
                        const name = editWorkspaceName.trim();
                        if (name) {
                          updateWorkspace.mutate({
                            id: workspace.id,
                            name,
                            description: editWorkspaceDescription.trim(),
                          });
                        }
                      }}
                      className="mb-4 space-y-2"
                      aria-label={`Edit ${workspace.name}`}
                    >
                      <h3 className="text-base font-semibold text-gray-900">
                        {t('editWorkspace')}
                      </h3>
                      <input
                        autoFocus
                        value={editWorkspaceName}
                        onChange={(event) =>
                          setEditWorkspaceName(event.target.value)
                        }
                        placeholder={t('workspaceName')}
                        aria-label={t('workspaceName')}
                        className="field w-full"
                      />
                      <textarea
                        value={editWorkspaceDescription}
                        onChange={(event) =>
                          setEditWorkspaceDescription(event.target.value)
                        }
                        placeholder={t('workspaceDescription')}
                        aria-label={t('workspaceDescription')}
                        rows={2}
                        className="field min-h-[72px] w-full resize-y"
                      />
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="submit"
                          disabled={
                            !editWorkspaceName.trim() ||
                            updateWorkspace.isPending
                          }
                          className="btn-primary"
                        >
                          {t('saveChanges')}
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingWorkspaceId(null)}
                          className="btn-secondary"
                        >
                          {t('cancel')}
                        </button>
                      </div>
                    </form>
                  ) : (
                  <div
                    data-workspace-header
                    className="mb-4 block space-y-3 sm:flex sm:items-start sm:justify-between sm:space-y-0"
                  >
                    <div className="min-w-0">
                      <h3 className="text-base font-semibold text-gray-900">
                        {workspace.name}
                      </h3>
                      {workspace.description && (
                        <p className="mt-1 whitespace-pre-line break-words text-sm text-gray-600">
                          {workspace.description}
                        </p>
                      )}
                      <p
                        className={`text-xs text-gray-500 ${
                          workspace.description ? 'mt-1' : 'mt-0.5'
                        }`}
                      >
                        {t(
                          workspace._count.boards === 1
                            ? 'boardCount'
                            : 'boardCountPlural',
                          { count: workspace._count.boards },
                        )}{' '}
                        ·{' '}
                        {t(
                          workspace._count.members === 1
                            ? 'memberCount'
                            : 'memberCountPlural',
                          { count: workspace._count.members },
                        )}
                      </p>
                    </div>
                    <div
                      data-workspace-actions
                      className="flex flex-wrap items-center gap-2 sm:shrink-0 sm:justify-end"
                    >
                      <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                        <Users className="h-3 w-3" />
                        {workspace.memberRole}
                      </span>
                      {workspace.isWorkspaceMember && (
                        <Link
                          href={`/workspaces/${workspace.id}/members`}
                          className="rounded-md border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-600 transition-colors hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700"
                        >
                          {t('members')}
                        </Link>
                      )}
                      {workspace.isWorkspaceMember &&
                        workspace.memberRole !== 'MEMBER' && (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingWorkspaceId(workspace.id);
                              setEditWorkspaceName(workspace.name);
                              setEditWorkspaceDescription(
                                workspace.description ?? '',
                              );
                              setBoardFormWorkspaceId(null);
                              setError(null);
                            }}
                            aria-label={`${t('editWorkspace')} ${workspace.name}`}
                            title={t('editWorkspace')}
                            className="rounded-md border border-gray-200 p-1.5 text-gray-500 transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                        )}
                      {workspace.memberRole === 'OWNER' && (
                        <button
                          type="button"
                          onClick={() => {
                            setWorkspaceToDelete(workspace);
                            setDeleteWorkspaceError(null);
                          }}
                          aria-label={`${t('deleteWorkspace')} ${workspace.name}`}
                          title={t('deleteWorkspace')}
                          className="rounded-md border border-gray-200 p-1.5 text-gray-500 transition-colors hover:border-red-300 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                  )}

                  <div className="space-y-2">
                    {workspaceBoards.map((board) => (                      <Link
                        key={board.id}
                        href={`/board/${board.id}`}
                        className="flex items-center justify-between gap-3 rounded-md border border-gray-200 px-3 py-2 transition-colors hover:border-blue-400 hover:bg-blue-50"
                      >
                        <span className="min-w-0 truncate text-sm font-medium text-gray-800">
                          {board.title}
                        </span>
                        <span className="shrink-0 text-xs text-gray-500">
                          {t('columns', { count: board._count?.columns ?? 0 })}
                        </span>
                      </Link>
                    ))}

                    {workspaceBoards.length === 0 && (
                      <p className="rounded-md border border-dashed border-gray-200 px-3 py-4 text-center text-xs text-gray-500">
                        {t('noBoardsYet')}
                      </p>
                    )}
                  </div>

                  {workspace.isWorkspaceMember &&
                    workspace.memberRole !== 'MEMBER' &&
                    (workspace.pendingInvitees?.length ?? 0) > 0 && (
                      <div
                        className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2"
                        data-testid="pending-invitees"
                      >
                        <div className="block space-y-1 sm:flex sm:items-center sm:justify-between sm:gap-2 sm:space-y-0">
                          <p className="text-xs font-medium text-amber-900">
                            {t(
                              workspace.pendingInvitees!.length === 1
                                ? 'pendingInvitees'
                                : 'pendingInviteesPlural',
                              { count: workspace.pendingInvitees!.length },
                            )}
                          </p>
                          <Link
                            href={`/workspaces/${workspace.id}/members`}
                            className="text-xs font-semibold text-amber-900 underline underline-offset-2 hover:text-amber-950"
                          >
                            {t('manage')}
                          </Link>
                        </div>
                        <ul className="mt-1 space-y-0.5">
                          {workspace.pendingInvitees!.map((invitee) => (
                            <li
                              key={invitee.userId}
                              className="truncate text-xs text-amber-800"
                            >
                              {invitee.user.name}{' '}
                              <span className="text-amber-700">
                                · {invitee.boards.join(', ')}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                  {workspace.isWorkspaceMember &&
                    workspace.memberRole !== 'MEMBER' &&
                    (boardFormWorkspaceId === workspace.id ? (
                    <form
                      onSubmit={(event) => {
                        event.preventDefault();
                        if (boardTitle.trim()) {
                          createBoard.mutate({
                            workspaceId: workspace.id,
                            title: boardTitle.trim(),
                          });
                        }
                      }}
                      className="mt-3 flex flex-col gap-2 sm:flex-row"
                    >
                      <input
                        autoFocus
                        value={boardTitle}
                        onChange={(event) => setBoardTitle(event.target.value)}
                        placeholder={t('boardTitle')}
                        className="field flex-1"
                      />
                      <button
                        type="submit"
                        disabled={!boardTitle.trim() || createBoard.isPending}
                        className="btn-primary w-full sm:w-auto"
                      >
                        {t('add')}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setBoardFormWorkspaceId(null);
                          setBoardTitle('');
                        }}
                        className="btn-secondary w-full sm:w-auto"
                      >
                        {t('cancel')}
                      </button>
                    </form>
                  ) : (
                    <button
                      onClick={() => {
                        setBoardFormWorkspaceId(workspace.id);
                        setBoardTitle('');
                      }}
                      className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700"
                    >
                      <Plus className="h-4 w-4" />
                      {t('addBoard')}
                    </button>
                    ))}
                </section>
              );
            })}
          </div>
        )}
      </main>

      {workspaceToDelete && (
        <ConfirmDialog
          open
          title={t('deleteWorkspaceTitle')}
          description={t('deleteWorkspaceDescription', {
            name: workspaceToDelete.name,
          })}
          summary={t('deleteWorkspaceSummary', {
            boards: t(
              workspaceToDelete._count.boards === 1
                ? 'boardCount'
                : 'boardCountPlural',
              { count: workspaceToDelete._count.boards },
            ),
            members: t(
              workspaceToDelete._count.members === 1
                ? 'memberCount'
                : 'memberCountPlural',
              { count: workspaceToDelete._count.members },
            ),
          })}
          confirmLabel={t('deleteWorkspace')}
          pendingLabel={t('deleting')}
          isPending={deleteWorkspace.isPending}
          error={deleteWorkspaceError}
          onConfirm={() => {
            if (!deleteWorkspace.isPending) {
              deleteWorkspace.mutate(workspaceToDelete);
            }
          }}
          onClose={() => {
            if (deleteWorkspace.isPending) return;
            setWorkspaceToDelete(null);
            setDeleteWorkspaceError(null);
          }}
        />
      )}
    </div>
  );
}
