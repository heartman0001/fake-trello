import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateLabelDTO, UpdateLabelDTO } from '@fake-trello/shared';

@Injectable()
export class LabelsService {
  constructor(private prisma: PrismaService) {}

  async findAll(boardId: string) {
    return this.prisma.label.findMany({
      where: { boardId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findById(id: string) {
    const label = await this.prisma.label.findUnique({ where: { id } });

    if (!label) {
      throw new NotFoundException('Label not found');
    }

    return label;
  }

  async create(boardId: string, dto: CreateLabelDTO) {
    return this.prisma.label.create({
      data: {
        boardId,
        name: dto.name,
        color: dto.color,
      },
    });
  }

  async update(boardId: string, id: string, dto: UpdateLabelDTO) {
    await this.ensureLabelOnBoard(boardId, id);

    return this.prisma.label.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.color !== undefined ? { color: dto.color } : {}),
      },
    });
  }

  async delete(boardId: string, id: string) {
    await this.ensureLabelOnBoard(boardId, id);

    await this.prisma.label.delete({ where: { id } });
    return { message: 'Label deleted successfully' };
  }

  private async ensureLabelOnBoard(boardId: string, labelId: string) {
    const label = await this.prisma.label.findUnique({
      where: { id: labelId },
      select: { boardId: true },
    });

    if (!label || label.boardId !== boardId) {
      throw new NotFoundException('Label not found on this board');
    }
  }
}
