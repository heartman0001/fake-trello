import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import {
  ActivityType,
  CreateCardDTO,
  FractionalIndex,
  UpdateCardDTO,
} from '@fake-trello/shared';

const CARD_INCLUDE = {
  labels: { include: { label: true } },
  checklist: { include: { items: { orderBy: { position: 'asc' as const } } } },
  comments: {
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: 'desc' as const },
  },
  assignee: { select: { id: true, name: true, email: true } },
};

@Injectable()
export class CardsService {
  constructor(
    private prisma: PrismaService,
    private realtime: RealtimeGateway,
  ) {}

  async findAll(columnId: string) {
    return this.prisma.card.findMany({
      where: { columnId },
      include: CARD_INCLUDE,
      orderBy: { position: 'asc' },
    });
  }

  async findById(id: string) {
    const card = await this.prisma.card.findUnique({
      where: { id },
      include: CARD_INCLUDE,
    });

    if (!card) {
      throw new NotFoundException('Card not found');
    }

    return card;
  }

  async create(
    boardId: string,
    columnId: string,
    userId: string,
    dto: CreateCardDTO,
  ) {
    await this.ensureColumnAccess(boardId, columnId, userId);

    const lastCard = await this.prisma.card.findFirst({
      where: { columnId },
      orderBy: { position: 'desc' },
      select: { position: true },
    });

    const position = dto.position || FractionalIndex.after(lastCard?.position ?? null);

    const card = await this.prisma.card.create({
      data: {
        columnId,
        title: dto.title,
        description: dto.description || null,
        position,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        assigneeId: dto.assigneeId || null,
      },
      include: CARD_INCLUDE,
    });

    await this.logActivity(boardId, userId, ActivityType.CARD_CREATED, {
      cardId: card.id,
      title: card.title,
      columnId,
    });

    this.realtime.broadcastCardCreated(boardId, card);
    return card;
  }

  async update(id: string, userId: string, dto: UpdateCardDTO) {
    const existing = await this.prisma.card.findUnique({
      where: { id },
      include: { column: { select: { boardId: true } } },
    });

    if (!existing) {
      throw new NotFoundException('Card not found');
    }

    await this.ensureBoardAccess(existing.column.boardId, userId);

    const card = await this.prisma.card.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description || null }
          : {}),
        ...(dto.dueDate !== undefined
          ? { dueDate: dto.dueDate ? new Date(dto.dueDate) : null }
          : {}),
        ...(dto.assigneeId !== undefined
          ? { assigneeId: dto.assigneeId || null }
          : {}),
      },
      include: CARD_INCLUDE,
    });

    await this.logActivity(existing.column.boardId, userId, ActivityType.CARD_UPDATED, {
      cardId: card.id,
      title: card.title,
    });

    this.realtime.broadcastCardUpdated(existing.column.boardId, card);
    return card;
  }

  async delete(id: string, userId: string) {
    const existing = await this.prisma.card.findUnique({
      where: { id },
      include: { column: { select: { boardId: true } } },
    });

    if (!existing) {
      throw new NotFoundException('Card not found');
    }

    await this.ensureBoardAccess(existing.column.boardId, userId);

    await this.prisma.card.delete({ where: { id } });

    await this.logActivity(
      existing.column.boardId,
      userId,
      ActivityType.CARD_DELETED,
      { cardId: id, title: existing.title },
    );

    this.realtime.broadcastCardDeleted(existing.column.boardId, id);
    return { message: 'Card deleted successfully' };
  }

  async move(
    boardId: string,
    sourceColumnId: string,
    cardId: string,
    userId: string,
    targetColumnId: string,
    position: string | null,
  ) {
    if (!targetColumnId) {
      throw new BadRequestException('targetColumnId is required');
    }

    await this.ensureBoardAccess(boardId, userId);
    await this.ensureColumnAccess(boardId, targetColumnId, userId);

    const card = await this.prisma.card.findUnique({
      where: { id: cardId },
      select: { id: true, columnId: true, title: true },
    });

    if (!card || card.columnId !== sourceColumnId) {
      throw new NotFoundException('Card not found in source column');
    }

    let newPosition = position;
    if (!newPosition) {
      const lastCard = await this.prisma.card.findFirst({
        where: { columnId: targetColumnId, id: { not: cardId } },
        orderBy: { position: 'desc' },
        select: { position: true },
      });
      newPosition = FractionalIndex.after(lastCard?.position ?? null);
    }

    const updated = await this.prisma.card.update({
      where: { id: cardId },
      data: { columnId: targetColumnId, position: newPosition },
      include: CARD_INCLUDE,
    });

    await this.logActivity(boardId, userId, ActivityType.CARD_MOVED, {
      cardId,
      title: card.title,
      fromColumnId: sourceColumnId,
      toColumnId: targetColumnId,
      position: newPosition,
    });

    this.realtime.broadcastCardMoved(boardId, updated);
    return updated;
  }

  async addLabel(
    boardId: string,
    columnId: string,
    cardId: string,
    labelId: string,
    userId: string,
  ) {
    await this.ensureColumnAccess(boardId, columnId, userId);

    const label = await this.prisma.label.findUnique({
      where: { id: labelId },
      select: { boardId: true },
    });

    if (!label || label.boardId !== boardId) {
      throw new NotFoundException('Label not found on this board');
    }

    await this.prisma.cardLabel.upsert({
      where: { cardId_labelId: { cardId, labelId } },
      update: {},
      create: { cardId, labelId },
    });

    const card = await this.findById(cardId);
    this.realtime.broadcastCardUpdated(boardId, card);
    return card;
  }

  async removeLabel(
    boardId: string,
    columnId: string,
    cardId: string,
    labelId: string,
    userId: string,
  ) {
    await this.ensureColumnAccess(boardId, columnId, userId);

    await this.prisma.cardLabel.deleteMany({ where: { cardId, labelId } });

    const card = await this.findById(cardId);
    this.realtime.broadcastCardUpdated(boardId, card);
    return card;
  }

  private async ensureBoardAccess(boardId: string, userId: string) {
    const board = await this.prisma.board.findUnique({
      where: { id: boardId },
      include: {
        workspace: {
          include: {
            members: { where: { userId }, select: { id: true } },
          },
        },
      },
    });

    if (!board) {
      throw new NotFoundException('Board not found');
    }

    if (board.workspace.ownerId !== userId && board.workspace.members.length === 0) {
      throw new ForbiddenException('You do not have access to this board');
    }
  }

  private async ensureColumnAccess(
    boardId: string,
    columnId: string,
    userId: string,
  ) {
    await this.ensureBoardAccess(boardId, userId);

    const column = await this.prisma.column.findUnique({
      where: { id: columnId },
      select: { boardId: true },
    });

    if (!column || column.boardId !== boardId) {
      throw new NotFoundException('Column not found on this board');
    }
  }

  private async logActivity(
    boardId: string,
    userId: string,
    type: ActivityType,
    metadata: Prisma.InputJsonValue,
  ) {
    const activity = await this.prisma.activityLog.create({
      data: { boardId, userId, type, metadata },
      include: { user: { select: { id: true, name: true } } },
    });

    this.realtime.broadcastActivityLogged(boardId, activity);
  }
}
