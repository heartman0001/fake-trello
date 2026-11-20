import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateBoardDTO, UpdateBoardDTO, ActivityType } from '@fake-trello/shared';

@Injectable()
export class BoardsService {
  constructor(private prisma: PrismaService) {}

  async findAll(userId: string) {
    // A user can reach a board three ways: they own the workspace, they are a
    // workspace member, or they were invited to that specific board.
    const boards = await this.prisma.board.findMany({
      where: {
        OR: [
          { workspace: { ownerId: userId } },
          { workspace: { members: { some: { userId } } } },
          { boardMembers: { some: { userId } } },
        ],
      },
      include: {
        workspace: {
          select: {
            id: true,
            name: true,
            ownerId: true,
            members: { where: { userId }, select: { role: true } },
          },
        },
        boardMembers: { where: { userId }, select: { role: true } },
        _count: {
          select: { columns: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return boards.map(({ workspace, boardMembers, ...board }) => ({
      ...board,
      workspaceId: workspace.id,
      workspaceName: workspace.name,
      workspaceMemberRole:
        workspace.ownerId === userId
          ? 'OWNER'
          : boardMembers[0]?.role ??
            workspace.members[0]?.role ??
            'MEMBER',
    }));
  }

  async findById(id: string, userId: string) {
    const workspace = await this.prisma.workspace.findFirst({
      where: {
        boards: { some: { id } },
        OR: [
          { ownerId: userId },
          { members: { some: { userId } } },
          // Invited board members can open the board without joining the
          // workspace.
          { boards: { some: { id, boardMembers: { some: { userId } } } } },
        ],
      },
      include: {
        owner: { select: { id: true, name: true, email: true } },
        members: {
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
          orderBy: { joinedAt: 'asc' },
        },
        boards: {
          where: { id },
          include: {
            columns: {
              orderBy: { position: 'asc' },
              include: {
                cards: {
                  orderBy: { position: 'asc' },
                  include: {
                    labels: { include: { label: true } },
                    checklist: {
                      include: { items: { orderBy: { position: 'asc' } } },
                    },
                    comments: {
                      include: {
                        user: { select: { id: true, name: true, email: true } },
                      },
                      orderBy: { createdAt: 'desc' },
                    },
                    assignee: {
                      select: { id: true, name: true, email: true },
                    },
                  },
                },
              },
            },
            labels: true,
            boardMembers: {
              include: {
                user: {
                  select: { id: true, name: true, email: true },
                },
              },
              orderBy: { joinedAt: 'asc' },
            },
            _count: {
              select: { columns: true },
            },
          },
        },
      },
    });

    if (!workspace || !workspace.boards[0]) {
      throw new NotFoundException('Board not found');
    }

    const board = workspace.boards[0];
    const memberRole =
      workspace.ownerId === userId
        ? 'OWNER'
        : board.boardMembers.find((member) => member.userId === userId)?.role ??
          workspace.members.find((member) => member.userId === userId)?.role ??
          'MEMBER';

    return {
      ...board,
      workspaceName: workspace.name,
      workspaceMemberRole: memberRole,
      // Board members are the owner plus explicit BoardMember rows. Workspace
      // members gain board access through the workspace, but they only show up
      // here (and leave the invite list) once they are added to the board.
      members: [
        ...(board.boardMembers.some(
          (member) => member.userId === workspace.ownerId,
        )
          ? []
          : [
              {
                id: `owner-${workspace.ownerId}`,
                userId: workspace.ownerId,
                role: 'OWNER' as const,
                user: workspace.owner,
              },
            ]),
        ...board.boardMembers.map((bm) => ({
          id: bm.id,
          userId: bm.userId,
          role: bm.role,
          user: bm.user,
        })),
      ],
    };
  }

  async create(userId: string, createBoardDto: CreateBoardDTO) {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: createBoardDto.workspaceId },
      include: { members: { where: { userId }, select: { role: true } } },
    });

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    const isOwner = workspace.ownerId === userId;
    const isAdmin = workspace.members[0]?.role === 'ADMIN';

    if (!isOwner && !isAdmin) {
      throw new ForbiddenException('You do not have permission to create a board in this workspace');
    }

    const board = await this.prisma.board.create({
      data: {
        ...createBoardDto,
        workspaceId: workspace.id,
      },
    });

    return board;
  }

  async update(id: string, userId: string, updateBoardDto: UpdateBoardDTO) {
    await this.ensureBoardAccess(id, userId);

    const board = await this.prisma.board.update({
      where: { id },
      data: updateBoardDto,
    });

    return board;
  }

  async delete(id: string, userId: string) {
    await this.ensureBoardAccess(id, userId);

    await this.prisma.board.delete({
      where: { id },
    });

    return { message: 'Board deleted successfully' };
  }

  async addMember(
    boardId: string,
    actorUserId: string,
    targetUserId: string,
    role: string,
  ) {
    await this.ensureBoardAccess(boardId, actorUserId);

    const board = await this.prisma.board.findUnique({
      where: { id: boardId },
      select: { workspaceId: true },
    });

    if (!board) {
      throw new NotFoundException('Board not found');
    }

    const targetUser = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true },
    });

    if (!targetUser) {
      throw new NotFoundException('User not found');
    }

    const existingMember = await this.prisma.boardMember.findUnique({
      where: {
        boardId_userId: {
          boardId,
          userId: targetUserId,
        },
      },
    });

    if (existingMember) {
      throw new ForbiddenException('User is already a member of this board');
    }

    const member = await this.prisma.boardMember.create({
      data: {
        boardId,
        userId: targetUserId,
        role: role as any,
      },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    // Log activity against the user who performed the invite.
    await this.prisma.activityLog.create({
      data: {
        boardId,
        userId: actorUserId,
        type: ActivityType.MEMBER_ADDED,
        metadata: { userId: targetUserId, role },
      },
    });

    return member;
  }

  async removeMember(boardId: string, userId: string, targetUserId: string) {
    await this.ensureBoardAccess(boardId, userId);

    const member = await this.prisma.boardMember.findUnique({
      where: {
        boardId_userId: {
          boardId,
          userId: targetUserId,
        },
      },
    });

    if (!member) {
      throw new NotFoundException('Member not found');
    }

    if (member.role === 'OWNER') {
      throw new ForbiddenException('Cannot remove board owner');
    }

    await this.prisma.boardMember.delete({
      where: {
        boardId_userId: {
          boardId,
          userId: targetUserId,
        },
      },
    });

    // Log activity
    await this.prisma.activityLog.create({
      data: {
        boardId,
        userId,
        type: ActivityType.MEMBER_REMOVED,
        metadata: { userId: targetUserId },
      },
    });

    return { message: 'Member removed successfully' };
  }

  async getMembers(boardId: string) {
    const board = await this.prisma.board.findUnique({
      where: { id: boardId },
      include: {
        boardMembers: {
          include: {
            user: {
              select: { id: true, name: true, email: true },
            },
          },
          orderBy: { joinedAt: 'asc' },
        },
      },
    });

    if (!board) {
      throw new NotFoundException('Board not found');
    }

    return board.boardMembers;
  }

  async isMember(boardId: string, userId: string) {
    const member = await this.prisma.boardMember.findUnique({
      where: {
        boardId_userId: {
          boardId,
          userId,
        },
      },
    });

    return !!member;
  }

  private async ensureBoardAccess(boardId: string, userId: string) {
    const board = await this.prisma.board.findUnique({
      where: { id: boardId },
      include: {
        workspace: {
          include: {
            members: { where: { userId }, select: { role: true } },
          },
        },
        boardMembers: { where: { userId }, select: { role: true } },
      },
    });

    if (!board) {
      throw new NotFoundException('Board not found');
    }

    const isOwner = board.workspace.ownerId === userId;
    const isWorkspaceAdmin = board.workspace.members[0]?.role === 'ADMIN';
    const isBoardAdmin = board.boardMembers[0]?.role === 'ADMIN';

    if (!isOwner && !isWorkspaceAdmin && !isBoardAdmin) {
      throw new ForbiddenException('You do not have permission to manage this board');
    }
  }
}
