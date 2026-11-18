import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import {
  ActivityType,
  CreateCommentDTO,
  UpdateCommentDTO,
} from '@fake-trello/shared';

const COMMENT_INCLUDE = {
  user: { select: { id: true, name: true, email: true } },
};

@Injectable()
export class CommentsService {
  constructor(
    private prisma: PrismaService,
    private realtime: RealtimeGateway,
  ) {}

  async findAll(cardId: string) {
    return this.prisma.comment.findMany({
      where: { cardId },
      include: COMMENT_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string) {
    const comment = await this.prisma.comment.findUnique({
      where: { id },
      include: COMMENT_INCLUDE,
    });

    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    return comment;
  }

  async create(cardId: string, userId: string, dto: CreateCommentDTO) {
    const context = await this.ensureCardAccess(cardId, userId);

    const comment = await this.prisma.comment.create({
      data: { cardId, userId, content: dto.content },
      include: COMMENT_INCLUDE,
    });

    await this.prisma.activityLog.create({
      data: {
        boardId: context.boardId,
        userId,
        type: ActivityType.CARD_COMMENTED,
        metadata: { cardId, commentId: comment.id },
      },
    });

    this.realtime.broadcastCardCommented(context.boardId, comment);
    return comment;
  }

  async update(id: string, userId: string, dto: UpdateCommentDTO) {
    const comment = await this.prisma.comment.findUnique({
      where: { id },
      include: {
        card: { include: { column: { select: { boardId: true } } } },
      },
    });

    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    if (comment.userId !== userId) {
      throw new ForbiddenException('You can only edit your own comments');
    }

    const updated = await this.prisma.comment.update({
      where: { id },
      data: { content: dto.content },
      include: COMMENT_INCLUDE,
    });

    this.realtime.broadcastCardCommented(
      comment.card.column.boardId,
      updated,
    );
    return updated;
  }

  async delete(id: string, userId: string) {
    const comment = await this.prisma.comment.findUnique({
      where: { id },
      include: {
        card: { include: { column: { select: { boardId: true } } } },
      },
    });

    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    if (comment.userId !== userId) {
      throw new ForbiddenException('You can only delete your own comments');
    }

    await this.prisma.comment.delete({ where: { id } });

    this.realtime.broadcastCardCommented(comment.card.column.boardId, {
      id,
      cardId: comment.cardId,
      deleted: true,
    });

    return { message: 'Comment deleted successfully' };
  }

  private async ensureCardAccess(cardId: string, userId: string) {
    const card = await this.prisma.card.findUnique({
      where: { id: cardId },
      include: {
        column: {
          include: {
            board: {
              include: {
                workspace: {
                  include: {
                    members: { where: { userId }, select: { id: true } },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!card) {
      throw new NotFoundException('Card not found');
    }

    const { workspace } = card.column.board;
    if (workspace.ownerId !== userId && workspace.members.length === 0) {
      throw new ForbiddenException('You do not have access to this card');
    }

    return { boardId: card.column.boardId };
  }
}
