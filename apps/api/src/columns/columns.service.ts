import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateColumnDTO, UpdateColumnDTO } from '@fake-trello/shared';
import { FractionalIndex } from '@fake-trello/shared';

@Injectable()
export class ColumnsService {
  constructor(private prisma: PrismaService) {}

  async findAll(boardId: string) {
    const columns = await this.prisma.column.findMany({
      where: { boardId },
      orderBy: { position: 'asc' },
    });

    return columns;
  }

  async findById(boardId: string, id: string) {
    const column = await this.prisma.column.findFirst({
      where: { id, boardId },
      include: {
        cards: {
          orderBy: { position: 'asc' },
        },
      },
    });

    if (!column) {
      throw new NotFoundException('Column not found on this board');
    }

    return column;
  }

  async create(boardId: string, userId: string, createColumnDto: CreateColumnDTO) {
    await this.ensureBoardAccess(boardId, userId);

    const existingColumns = await this.prisma.column.findMany({
      where: { boardId },
      orderBy: { position: 'asc' },
    });

    const position =
      existingColumns.length > 0
        ? FractionalIndex.after(
            existingColumns[existingColumns.length - 1].position,
          )
        : FractionalIndex.before(null);

    const column = await this.prisma.column.create({
      data: {
        ...createColumnDto,
        boardId,
        position,
      },
      include: {
        cards: true,
      },
    });

    return column;
  }

  async update(
    boardId: string,
    id: string,
    userId: string,
    updateColumnDto: UpdateColumnDTO,
  ) {
    await this.ensureColumnAccess(boardId, id, userId);

    const column = await this.prisma.column.update({
      where: { id },
      data: updateColumnDto,
    });

    return column;
  }

  async delete(boardId: string, id: string, userId: string) {
    await this.ensureColumnAccess(boardId, id, userId);

    const column = await this.prisma.column.findUnique({
      where: { id },
      select: { boardId: true },
    });

    if (!column) {
      throw new NotFoundException('Column not found');
    }

    await this.prisma.column.delete({
      where: { id },
    });

    return { message: 'Column deleted successfully' };
  }

  async reorder(
    boardId: string,
    userId: string,
    columnIds: string[],
  ) {
    await this.ensureBoardAccess(boardId, userId);

    const columns = await this.prisma.column.findMany({
      where: { boardId },
      select: { id: true },
    });
    const boardColumnIds = new Set(columns.map((column) => column.id));

    if (columnIds.some((id) => !boardColumnIds.has(id))) {
      throw new ForbiddenException('Column does not belong to this board');
    }

    let previousPosition: string | null = null;
    const updates = columnIds.map((id, index) => {
      const position =
        index === 0
          ? FractionalIndex.before(null)
          : FractionalIndex.after(previousPosition);
      previousPosition = position;

      return this.prisma.column.update({
        where: { id },
        data: { position },
      });
    });

    await this.prisma.$transaction(updates);

    return { message: 'Columns reordered successfully' };
  }

  private async ensureBoardAccess(boardId: string, userId: string) {
    const workspace = await this.prisma.workspace.findFirst({
      where: {
        boards: { some: { id: boardId } },
        OR: [
          { ownerId: userId },
          { members: { some: { userId } } },
          { boards: { some: { id: boardId, boardMembers: { some: { userId } } } } },
        ],
      },
    });

    if (!workspace) {
      throw new ForbiddenException('You do not have access to this board');
    }
  }

  private async ensureColumnAccess(
    boardId: string,
    columnId: string,
    userId: string,
  ) {
    const column = await this.prisma.column.findUnique({
      where: { id: columnId },
      include: {
        board: {
          include: {
            workspace: {
              include: {
                members: { where: { userId }, select: { userId: true } },
              },
            },
            boardMembers: { where: { userId }, select: { userId: true } },
          },
        },
      },
    });

    if (!column || column.boardId !== boardId) {
      throw new NotFoundException('Column not found on this board');
    }

    const isOwner = column.board.workspace.ownerId === userId;
    const isMember = column.board.workspace.members.some(
      (m) => m.userId === userId,
    );
    const isBoardMember = column.board.boardMembers.some(
      (m) => m.userId === userId,
    );

    if (!isOwner && !isMember && !isBoardMember) {
      throw new ForbiddenException('You do not have permission to access this column');
    }
  }
}
