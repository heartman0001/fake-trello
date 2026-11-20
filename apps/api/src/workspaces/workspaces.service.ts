import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateWorkspaceDTO, UpdateWorkspaceDTO } from '@fake-trello/shared';

interface BoardInviteeSource {
  title: string;
  boardMembers: {
    userId: string;
    user: { id: string; name: string; email: string };
  }[];
}

function collectBoardInvitees(
  boards: BoardInviteeSource[],
  memberIds: Set<string>,
) {
  const invitees = new Map<
    string,
    {
      userId: string;
      user: { id: string; name: string; email: string };
      boards: string[];
    }
  >();

  for (const board of boards) {
    for (const boardMember of board.boardMembers) {
      if (memberIds.has(boardMember.userId)) continue;

      const entry = invitees.get(boardMember.userId) ?? {
        userId: boardMember.userId,
        user: boardMember.user,
        boards: [],
      };

      if (!entry.boards.includes(board.title)) {
        entry.boards.push(board.title);
      }

      invitees.set(boardMember.userId, entry);
    }
  }

  return [...invitees.values()].sort((a, b) =>
    a.user.name.localeCompare(b.user.name),
  );
}

@Injectable()
export class WorkspacesService {
  constructor(private prisma: PrismaService) {}

  async findAll(userId: string) {
    const workspaces = await this.prisma.workspace.findMany({
      where: {
        OR: [
          { ownerId: userId },
          { members: { some: { userId } } },
          // Invited board members need the parent workspace to group their
          // board on the workspaces page.
          { boards: { some: { boardMembers: { some: { userId } } } } },
        ],
      },
      include: {
        owner: {
          select: { id: true, email: true, name: true },
        },
        members: {
          select: { userId: true, role: true },
        },
        boards: {
          select: {
            title: true,
            boardMembers: {
              select: {
                userId: true,
                user: { select: { id: true, name: true, email: true } },
              },
            },
          },
        },
        _count: {
          select: { boards: true, members: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return workspaces.map(({ members, boards, ...ws }) => {
      const isWorkspaceMember =
        ws.ownerId === userId || members.length > 0;
      const memberRole =
        ws.ownerId === userId
          ? 'OWNER'
          : members.find((member) => member.userId === userId)?.role ??
            'MEMBER';
      const canManage = isWorkspaceMember && memberRole !== 'MEMBER';
      const memberIds = new Set([
        ws.ownerId,
        ...members.map((member) => member.userId),
      ]);

      return {
        ...ws,
        memberRole,
        isWorkspaceMember,
        pendingInvitees: canManage
          ? collectBoardInvitees(boards, memberIds)
          : [],
      };
    });
  }

  async findById(id: string, userId: string) {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id },
      include: {
        owner: { select: { id: true, email: true, name: true } },
        members: {
          include: {
            user: {
              select: { id: true, email: true, name: true },
            },
          },
          orderBy: { joinedAt: 'asc' },
        },
      },
    });

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    const member = workspace.members.find((m) => m.userId === userId);
    if (!member && workspace.ownerId !== userId) {
      throw new ForbiddenException('You do not have access to this workspace');
    }

    return {
      ...workspace,
      memberRole: member?.role || (workspace.ownerId === userId ? 'OWNER' : 'MEMBER'),
    };
  }

  async create(userId: string, createWorkspaceDto: CreateWorkspaceDTO) {
    const workspace = await this.prisma.workspace.create({
      data: {
        ...createWorkspaceDto,
        ownerId: userId,
      },
      include: {
        owner: { select: { id: true, email: true, name: true } },
      },
    });

    // Add user as owner
    await this.prisma.workspaceMember.create({
      data: {
        workspaceId: workspace.id,
        userId,
        role: 'OWNER',
      },
    });

    return workspace;
  }

  async update(id: string, userId: string, updateWorkspaceDto: UpdateWorkspaceDTO) {
    await this.ensureWorkspaceAdmin(id, userId);

    const workspace = await this.prisma.workspace.update({
      where: { id },
      data: updateWorkspaceDto,
      include: {
        owner: { select: { id: true, email: true, name: true } },
      },
    });

    return workspace;
  }

  async delete(id: string, userId: string) {
    await this.ensureWorkspaceOwner(id, userId);

    await this.prisma.workspace.delete({
      where: { id },
    });

    return { message: 'Workspace deleted successfully' };
  }

  /**
   * Workspace member management view: members plus users who were invited to a
   * board in this workspace but are not workspace members yet (promotable).
   */
  async getManagement(workspaceId: string, userId: string) {
    await this.ensureWorkspaceAccess(workspaceId, userId);

    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: {
        owner: { select: { id: true, name: true, email: true } },
        members: {
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
          orderBy: { joinedAt: 'asc' },
        },
        boards: {
          select: {
            id: true,
            title: true,
            boardMembers: {
              include: {
                user: { select: { id: true, name: true, email: true } },
              },
            },
          },
        },
      },
    });

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    const memberIds = new Set([
      workspace.ownerId,
      ...workspace.members.map((member) => member.userId),
    ]);

    const invitees = collectBoardInvitees(workspace.boards, memberIds);

    return {
      id: workspace.id,
      name: workspace.name,
      description: workspace.description,
      owner: workspace.owner,
      memberRole:
        workspace.ownerId === userId
          ? 'OWNER'
          : workspace.members.find((member) => member.userId === userId)
              ?.role ?? 'MEMBER',
      members: workspace.members.map((member) => ({
        id: member.id,
        userId: member.userId,
        role: member.role,
        user: member.user,
      })),
      invitees,
    };
  }

  async updateMemberRole(
    workspaceId: string,
    actorUserId: string,
    targetUserId: string,
    role: string,
  ) {
    if (role !== 'ADMIN' && role !== 'MEMBER') {
      throw new BadRequestException('Role must be ADMIN or MEMBER');
    }

    await this.ensureWorkspaceAdmin(workspaceId, actorUserId);

    if (actorUserId === targetUserId) {
      throw new ForbiddenException('You cannot change your own role');
    }

    const member = await this.prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: { workspaceId, userId: targetUserId },
      },
    });

    if (!member) {
      throw new NotFoundException('Member not found');
    }

    if (member.role === 'OWNER') {
      throw new ForbiddenException('Cannot change the workspace owner\'s role');
    }

    return this.prisma.workspaceMember.update({
      where: {
        workspaceId_userId: { workspaceId, userId: targetUserId },
      },
      data: { role: role as any },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });
  }

  async addMember(workspaceId: string, userId: string, targetUserId: string, role: string) {
    if (role !== 'ADMIN' && role !== 'MEMBER') {
      throw new BadRequestException('Role must be ADMIN or MEMBER');
    }

    await this.ensureWorkspaceAdmin(workspaceId, userId);

    const existingMember = await this.prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId: targetUserId,
        },
      },
    });

    if (existingMember) {
      throw new ForbiddenException('User is already a member of this workspace');
    }

    const member = await this.prisma.workspaceMember.create({
      data: {
        workspaceId,
        userId: targetUserId,
        role: role as any,
      },
      include: {
        user: {
          select: { id: true, email: true, name: true },
        },
      },
    });

    return member;
  }

  async removeMember(workspaceId: string, userId: string, targetUserId: string) {
    await this.ensureWorkspaceAdmin(workspaceId, userId);

    const member = await this.prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId: targetUserId,
        },
      },
    });

    if (!member) {
      throw new NotFoundException('Member not found');
    }

    if (member.role === 'OWNER') {
      throw new ForbiddenException('Cannot remove workspace owner');
    }

    if (targetUserId === userId) {
      throw new ForbiddenException('You cannot remove yourself');
    }

    await this.prisma.workspaceMember.delete({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId: targetUserId,
        },
      },
    });

    return { message: 'Member removed successfully' };
  }

  private async ensureWorkspaceAdmin(workspaceId: string, userId: string) {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: {
        members: { where: { userId }, select: { role: true } },
      },
    });

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    const isOwner = workspace.ownerId === userId;
    const isAdmin = workspace.members[0]?.role === 'ADMIN';

    if (!isOwner && !isAdmin) {
      throw new ForbiddenException(
        'You do not have permission to manage workspace members',
      );
    }
  }

  private async ensureWorkspaceOwner(workspaceId: string, userId: string) {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { ownerId: true },
    });

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    if (workspace.ownerId !== userId) {
      throw new ForbiddenException(
        'Only the workspace owner can delete this workspace',
      );
    }
  }

  private async ensureWorkspaceAccess(workspaceId: string, userId: string) {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
    });

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    if (workspace.ownerId !== userId) {
      const member = await this.prisma.workspaceMember.findUnique({
        where: {
          workspaceId_userId: {
            workspaceId,
            userId,
          },
        },
      });

      if (!member) {
        throw new ForbiddenException('You do not have access to this workspace');
      }
    }
  }

  async getOtherWorkspaceMembers(workspaceId: string, currentUserId: string) {
    await this.ensureWorkspaceAccess(workspaceId, currentUserId);

    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: {
        members: {
          where: { userId: { not: currentUserId } },
          include: {
            user: {
              select: { id: true, name: true, email: true },
            },
          },
        },
      },
    });

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    return workspace.members;
  }
}
