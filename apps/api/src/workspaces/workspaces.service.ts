import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateWorkspaceDTO, UpdateWorkspaceDTO } from '@fake-trello/shared';

@Injectable()
export class WorkspacesService {
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
        owner: {
          select: { id: true, email: true, name: true },
        },
        members: {
          where: { userId },
          select: { role: true },
        },
        _count: {
          select: { boards: true, members: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return workspaces.map((ws) => ({
      ...ws,
      memberRole:
        ws.ownerId === userId ? 'OWNER' : ws.members[0]?.role || 'MEMBER',
    }));
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
    await this.ensureWorkspaceAccess(id, userId);

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
    await this.ensureWorkspaceAccess(id, userId);

    await this.prisma.workspace.delete({
      where: { id },
    });

    return { message: 'Workspace deleted successfully' };
  }

  async addMember(workspaceId: string, userId: string, targetUserId: string, role: string) {
    await this.ensureWorkspaceAccess(workspaceId, userId);

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
    await this.ensureWorkspaceAccess(workspaceId, userId);

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
}
