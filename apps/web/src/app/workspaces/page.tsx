'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { deleteCookie } from 'cookies-next';
import { LayoutGrid, LogOut, Plus, Users } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/useAuthStore';
import type { BoardSummary, WorkspaceSummary } from '@/types';

function LogoutButton() {
  const router = useRouter();
  const logout = useAuthStore((state) => state.logout);

  return (
    <button
      onClick={() => {
        deleteCookie('accessToken');
        deleteCookie('refreshToken');
        logout();
        router.push('/login');
        router.refresh();
      }}
      className="btn-secondary"
    >
      <LogOut className="h-4 w-4" />
      Sign out
    </button>
  );
}

export default function WorkspacesPage() {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);

  const [showWorkspaceForm, setShowWorkspaceForm] = useState(false);
  const [workspaceName, setWorkspaceName] = useState('');
  const [boardFormWorkspaceId, setBoardFormWorkspaceId] = useState<
    string | null
  >(null);
  const [boardTitle, setBoardTitle] = useState('');
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
      setWorkspaceName('');
      setShowWorkspaceForm(false);
      queryClient.invalidateQueries({ queryKey: ['workspaces'] });
    },
    onError: (err) => setError(err.message),
  });

  const createBoard = useMutation({
    mutationFn: ({ workspaceId, title }: { workspaceId: string; title: string }) =>
      api.post<BoardSummary>('/boards', { workspaceId, title }),
    onSuccess: () => {
      setBoardTitle('');
      setBoardFormWorkspaceId(null);
      queryClient.invalidateQueries({ queryKey: ['boards'] });
    },
    onError: (err) => setError(err.message),
  });

  const workspaces = workspacesQuery.data ?? [];
  const boards = boardsQuery.data ?? [];
  const isLoading = workspacesQuery.isLoading || boardsQuery.isLoading;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-sm font-bold text-white">
              FT
            </div>
            <div>
              <h1 className="text-lg font-semibold text-gray-900">
                Workspaces
              </h1>
              {user && (
                <p className="text-xs text-gray-500">Signed in as {user.name}</p>
              )}
            </div>
          </div>
          <LogoutButton />
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">Your work</h2>
          <button
            onClick={() => setShowWorkspaceForm((value) => !value)}
            className="btn-primary"
          >
            <Plus className="h-4 w-4" />
            New workspace
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
              placeholder="Workspace name"
              className="field flex-1"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowWorkspaceForm(false)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!workspaceName.trim() || createWorkspace.isPending}
                className="btn-primary"
              >
                Create
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
              No workspaces yet
            </h3>
            <p className="mt-1 max-w-sm text-sm text-gray-500">
              Create a workspace to start grouping boards for your team.
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
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-base font-semibold text-gray-900">
                        {workspace.name}
                      </h3>
                      <p className="mt-0.5 text-xs text-gray-500">
                        {workspace._count.boards} board
                        {workspace._count.boards !== 1 ? 's' : ''} ·{' '}
                        {workspace._count.members} member
                        {workspace._count.members !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                      <Users className="h-3 w-3" />
                      {workspace.memberRole}
                    </span>
                  </div>

                  <div className="space-y-2">
                    {workspaceBoards.map((board) => (
                      <Link
                        key={board.id}
                        href={`/board/${board.id}`}
                        className="flex items-center justify-between rounded-md border border-gray-200 px-3 py-2 transition-colors hover:border-blue-400 hover:bg-blue-50"
                      >
                        <span className="text-sm font-medium text-gray-800">
                          {board.title}
                        </span>
                        <span className="text-xs text-gray-500">
                          {board._count?.columns ?? 0} columns
                        </span>
                      </Link>
                    ))}

                    {workspaceBoards.length === 0 && (
                      <p className="rounded-md border border-dashed border-gray-200 px-3 py-4 text-center text-xs text-gray-500">
                        No boards in this workspace yet.
                      </p>
                    )}
                  </div>

                  {boardFormWorkspaceId === workspace.id ? (
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
                      className="mt-3 flex gap-2"
                    >
                      <input
                        autoFocus
                        value={boardTitle}
                        onChange={(event) => setBoardTitle(event.target.value)}
                        placeholder="Board title"
                        className="field flex-1"
                      />
                      <button
                        type="submit"
                        disabled={!boardTitle.trim() || createBoard.isPending}
                        className="btn-primary"
                      >
                        Add
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setBoardFormWorkspaceId(null);
                          setBoardTitle('');
                        }}
                        className="btn-secondary"
                      >
                        Cancel
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
                      Add board
                    </button>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
