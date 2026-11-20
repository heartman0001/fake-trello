'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Crown, Shield, UserMinus, UserPlus, Users } from 'lucide-react';
import type { WorkspaceMemberRole } from '@fake-trello/shared';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/useAuthStore';
import Select from '@/components/ui/Select';
import type { WorkspaceManagement } from '@/types';

const ROLE_OPTIONS = [
  { value: 'MEMBER', label: 'Member' },
  { value: 'ADMIN', label: 'Admin' },
];

function initials(name: string) {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export default function WorkspaceMembersPage() {
  const params = useParams();
  const workspaceId = params.workspaceId as string;
  const currentUser = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [inviteeRoles, setInviteeRoles] = useState<
    Record<string, WorkspaceMemberRole>
  >({});

  const managementQuery = useQuery({
    queryKey: ['workspace-management', workspaceId],
    queryFn: () =>
      api.get<WorkspaceManagement>(`/workspaces/${workspaceId}/manage`),
    enabled: !!workspaceId,
  });

  const refresh = () => {
    queryClient.invalidateQueries({
      queryKey: ['workspace-management', workspaceId],
    });
    queryClient.invalidateQueries({ queryKey: ['workspaces'] });
  };

  const updateRole = useMutation({
    mutationFn: ({
      userId,
      role,
    }: {
      userId: string;
      role: WorkspaceMemberRole;
    }) =>
      api.patch(`/workspaces/${workspaceId}/members/${userId}`, { role }),
    onSuccess: () => {
      setError(null);
      refresh();
    },
    onError: (err) => setError(err.message),
  });

  const removeMember = useMutation({
    mutationFn: (userId: string) =>
      api.delete(`/workspaces/${workspaceId}/members/${userId}`),
    onSuccess: () => {
      setError(null);
      refresh();
    },
    onError: (err) => setError(err.message),
  });

  const addInvitee = useMutation({
    mutationFn: ({
      userId,
      role,
    }: {
      userId: string;
      role: WorkspaceMemberRole;
    }) => api.post(`/workspaces/${workspaceId}/members`, { userId, role }),
    onSuccess: (_, variables) => {
      setError(null);
      setInviteeRoles((current) => {
        const next = { ...current };
        delete next[variables.userId];
        return next;
      });
      refresh();
    },
    onError: (err) => setError(err.message),
  });

  const workspace = managementQuery.data;
  const canManage =
    workspace?.memberRole === 'OWNER' || workspace?.memberRole === 'ADMIN';

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <Link
        href="/workspaces"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 transition-colors hover:text-gray-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Workspaces
      </Link>

      {managementQuery.isLoading ? (
        <div className="mt-8 space-y-4">
          <div className="h-10 w-64 animate-pulse rounded bg-gray-200" />
          <div className="h-40 animate-pulse rounded-lg bg-gray-200" />
        </div>
      ) : managementQuery.isError ? (
        <div className="mt-8 rounded-lg border border-red-200 bg-red-50 p-6">
          <p className="text-sm font-medium text-red-800">
            You cannot manage this workspace&apos;s members.
          </p>
          <p className="mt-1 text-sm text-red-700">
            {managementQuery.error.message}
          </p>
        </div>
      ) : workspace ? (
        <>
          <header className="mt-4 mb-8 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold text-gray-900">
                {workspace.name}
              </h1>
              <p className="mt-1 text-sm text-gray-500">
                Manage who can access this workspace and their roles.
              </p>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">
              <Shield className="h-3 w-3" />
              {workspace.memberRole}
            </span>
          </header>

          {error && (
            <div className="mb-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <section className="card-surface p-4 sm:p-6">
            <div className="mb-4 flex items-center gap-2">
              <Users className="h-4 w-4 text-gray-400" />
              <h2 className="text-base font-semibold text-gray-900">Members</h2>
              <span className="text-xs text-gray-500">
                {workspace.members.length}
              </span>
            </div>

            <ul className="divide-y divide-gray-100">
              {workspace.members.map((member) => {
                const isOwner = member.role === 'OWNER';
                const isSelf = member.userId === currentUser?.id;

                return (
                  <li
                    key={member.id}
                    className="flex flex-wrap items-center justify-between gap-3 py-3"
                  >
                    <div className="flex w-full min-w-0 items-center gap-3 sm:w-auto">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700">
                        {initials(member.user.name)}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-gray-900">
                          {member.user.name}
                          {isSelf && (
                            <span className="ml-1.5 text-xs font-normal text-gray-400">
                              (you)
                            </span>
                          )}
                        </p>
                        <p className="truncate text-xs text-gray-500">
                          {member.user.email}
                        </p>
                      </div>
                    </div>

                    <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                      {isOwner ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800">
                          <Crown className="h-3 w-3" />
                          Owner
                        </span>
                      ) : (
                        <Select
                          value={member.role}
                          options={ROLE_OPTIONS}
                          onChange={(role) =>
                            updateRole.mutate({
                              userId: member.userId,
                              role: role as WorkspaceMemberRole,
                            })
                          }
                          className="w-36 sm:w-32"
                          disabled={!canManage || isSelf || updateRole.isPending}
                        />
                      )}

                      {!isOwner && !isSelf && canManage && (
                        <button
                          type="button"
                          onClick={() => removeMember.mutate(member.userId)}
                          disabled={removeMember.isPending}
                          title={`Remove ${member.user.name}`}
                          aria-label={`Remove ${member.user.name}`}
                          className="rounded-md p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                        >
                          <UserMinus className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>

            {!canManage && (
              <p className="mt-4 rounded-md bg-gray-50 px-3 py-2 text-xs text-gray-500">
                Only workspace owners and admins can change roles or manage
                members.
              </p>
            )}
          </section>

          {canManage && (
            <section className="card-surface mt-6 p-4 sm:p-6" data-testid="board-invitees">
              <div className="mb-1 flex items-center gap-2">
                <UserPlus className="h-4 w-4 text-gray-400" />
                <h2 className="text-base font-semibold text-gray-900">
                  Board invitees
                </h2>
                <span className="text-xs text-gray-500">
                  {workspace.invitees.length}
                </span>
              </div>
              <p className="mb-4 text-sm text-gray-500">
                People invited to a board in this workspace but not yet a member.
                Add them and choose their role to promote them.
              </p>

              {workspace.invitees.length === 0 ? (
                <p className="rounded-md border border-dashed border-gray-200 px-3 py-6 text-center text-sm text-gray-500">
                  No board invitees waiting to be added.
                </p>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {workspace.invitees.map((invitee) => (
                    <li
                      key={invitee.userId}
                      className="flex flex-wrap items-center justify-between gap-3 py-3"
                    >
                      <div className="flex w-full min-w-0 items-center gap-3 sm:w-auto">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-semibold text-gray-600">
                          {initials(invitee.user.name)}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-gray-900">
                            {invitee.user.name}
                          </p>
                          <p className="truncate text-xs text-gray-500">
                            {invitee.user.email}
                          </p>
                          <p className="mt-0.5 truncate text-xs text-gray-400">
                            Board invitee · {invitee.boards.join(', ')}
                          </p>
                        </div>
                      </div>

                      <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                        <Select
                          value={inviteeRoles[invitee.userId] ?? 'MEMBER'}
                          options={ROLE_OPTIONS}
                          onChange={(role) =>
                            setInviteeRoles((current) => ({
                              ...current,
                              [invitee.userId]: role as WorkspaceMemberRole,
                            }))
                          }
                          className="w-full sm:w-32"
                          disabled={addInvitee.isPending}
                        />
                        <button
                          type="button"
                          onClick={() =>
                            addInvitee.mutate({
                              userId: invitee.userId,
                              role:
                                inviteeRoles[invitee.userId] ??
                                ('MEMBER' as WorkspaceMemberRole),
                            })
                          }
                          disabled={addInvitee.isPending}
                          className="btn-primary w-full whitespace-nowrap sm:w-auto"
                        >
                          Add to workspace
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </>
      ) : null}
    </main>
  );
}
