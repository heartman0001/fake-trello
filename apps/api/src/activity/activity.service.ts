import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateActivityLogDTO } from '@fake-trello/shared';

@Injectable()
export class ActivityService {
  constructor(private prisma: PrismaService) {}

  async create(createActivityLogDto: CreateActivityLogDTO) {
    const activity = await this.prisma.activityLog.create({ data: createActivityLogDto });
    return activity;
  }

  async findByBoard(boardId: string) {
    const activities = await this.prisma.activityLog.findMany({
      where: { boardId },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return activities;
  }
}
