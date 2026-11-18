import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateBoardDTO, UpdateBoardDTO } from '@fake-trello/shared';

@Injectable()
export class BoardsService {
  constructor(private prisma: PrismaService) {}

  async findAll(userId: string) {
    const workspaces = await this.prisma.workspace.findMany({
      where: {
        OR: [
          { ownerId: userId },
          { members: { some: { userId } } },
        ],
      },
      include: {
        members: { where: { userId }, select: { role: true } },
        boards: {
          include: {
            _count: {
              select: { columns: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    const boards = [];
    for (const workspace of workspaces) {
      const memberRole =
        workspace.ownerId === userId
          ? 'OWNER'
          : workspace.members[0]?.role || 'MEMBER';
      
      for (const board of workspace.boards) {
        boards.push({
          ...board,
          workspaceId: workspace.id,
          workspaceName: workspace.name,
          workspaceMemberRole: memberRole,
        });
      }
    }

    return boards;
  }

  async findById(id: string, userId: string) {
    const workspace = await this.prisma.workspace.findFirst({
      where: {
        boards: { some: { id } },
        OR: [
          { ownerId: userId },
          { members: { some: { userId } } },
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
        : workspace.members.find((member) => member.userId === userId)?.role ||
          'MEMBER';

    return {
      ...board,
      workspaceName: workspace.name,
      workspaceMemberRole: memberRole,
      members: [
        ...(workspace.members.some(
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
        ...workspace.members.map((member) => ({
          id: member.id,
          userId: member.userId,
          role: member.role,
          user: member.user,
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

  private async ensureBoardAccess(boardId: string, userId: string) {
    const board = await this.prisma.board.findUnique({
      where: { id: boardId },
      include: {
        workspace: {
          include: {
            members: { where: { userId }, select: { role: true } },
          },
        },
      },
    });

    if (!board) {
      throw new NotFoundException('Board not found');
    }

    const isOwner = board.workspace.ownerId === userId;
    const isAdmin = board.workspace.members[0]?.role === 'ADMIN';

    if (!isOwner && !isAdmin) {
      throw new ForbiddenException('You do not have permission to access this board');
    }
  }
}
