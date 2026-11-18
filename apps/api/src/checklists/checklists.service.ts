import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import {
  CreateChecklistDTO,
  UpdateChecklistDTO,
  UpdateChecklistItemDTO,
} from '@fake-trello/shared';

const CHECKLIST_INCLUDE = {
  items: { orderBy: { position: 'asc' as const } },
};

@Injectable()
export class ChecklistsService {
  constructor(private prisma: PrismaService) {}

  async findByCard(cardId: string) {
    return this.prisma.checklist.findUnique({
      where: { cardId },
      include: CHECKLIST_INCLUDE,
    });
  }

  async create(cardId: string, userId: string, dto: CreateChecklistDTO) {
    await this.ensureCardAccess(cardId, userId);

    return this.prisma.checklist.upsert({
      where: { cardId },
      update: { title: dto.title },
      create: { cardId, title: dto.title },
      include: CHECKLIST_INCLUDE,
    });
  }

  async update(id: string, userId: string, dto: UpdateChecklistDTO) {
    await this.ensureChecklistAccess(id, userId);

    return this.prisma.checklist.update({
      where: { id },
      data: { title: dto.title },
      include: CHECKLIST_INCLUDE,
    });
  }

  async delete(id: string, userId: string) {
    await this.ensureChecklistAccess(id, userId);
    await this.prisma.checklist.delete({ where: { id } });
    return { message: 'Checklist deleted successfully' };
  }

  async addItem(checklistId: string, userId: string, title: string) {
    await this.ensureChecklistAccess(checklistId, userId);

    const lastItem = await this.prisma.checklistItem.findFirst({
      where: { checklistId },
      orderBy: { position: 'desc' },
      select: { position: true },
    });

    return this.prisma.checklistItem.create({
      data: {
        checklistId,
        title,
        position: (lastItem?.position ?? -1) + 1,
      },
    });
  }

  async updateItem(
    checklistId: string,
    itemId: string,
    userId: string,
    dto: UpdateChecklistItemDTO,
  ) {
    await this.ensureChecklistAccess(checklistId, userId);

    const item = await this.prisma.checklistItem.findUnique({
      where: { id: itemId },
      select: { checklistId: true },
    });

    if (!item || item.checklistId !== checklistId) {
      throw new NotFoundException('Checklist item not found');
    }

    return this.prisma.checklistItem.update({
      where: { id: itemId },
      data: {
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.completed !== undefined ? { completed: dto.completed } : {}),
        ...(dto.position !== undefined ? { position: dto.position } : {}),
      },
    });
  }

  async deleteItem(checklistId: string, itemId: string, userId: string) {
    await this.ensureChecklistAccess(checklistId, userId);

    const item = await this.prisma.checklistItem.findUnique({
      where: { id: itemId },
      select: { checklistId: true },
    });

    if (!item || item.checklistId !== checklistId) {
      throw new NotFoundException('Checklist item not found');
    }

    await this.prisma.checklistItem.delete({ where: { id: itemId } });
    return { message: 'Checklist item deleted successfully' };
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
  }

  private async ensureChecklistAccess(checklistId: string, userId: string) {
    const checklist = await this.prisma.checklist.findUnique({
      where: { id: checklistId },
      include: {
        card: {
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
        },
      },
    });

    if (!checklist) {
      throw new NotFoundException('Checklist not found');
    }

    const { workspace } = checklist.card.column.board;
    if (workspace.ownerId !== userId && workspace.members.length === 0) {
      throw new ForbiddenException('You do not have access to this checklist');
    }
  }
}
