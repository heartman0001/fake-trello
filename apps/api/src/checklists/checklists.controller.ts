import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { ChecklistsService } from './checklists.service';
import { UpdateChecklistDTO, UpdateChecklistItemDTO } from '@fake-trello/shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { BoardMemberGuard } from '../common/guards/board-member.guard';

@Controller('boards/:boardId/columns/:columnId/cards/:cardId/checklists')
@UseGuards(BoardMemberGuard)
export class ChecklistsController {
  constructor(private checklistsService: ChecklistsService) {}

  @Get()
  async findByCard(
    @Param('boardId') boardId: string,
    @Param('columnId') columnId: string,
    @Param('cardId') cardId: string,
  ) {
    return this.checklistsService.findByCard(boardId, columnId, cardId);
  }

  @Post()
  async create(
    @Param('cardId') cardId: string,
    @CurrentUser() user: any,
    @Body() body: { title: string },
  ) {
    if (!body?.title?.trim()) {
      throw new BadRequestException('title is required');
    }

    return this.checklistsService.create(cardId, user.id, {
      cardId,
      title: body.title.trim(),
    });
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() updateChecklistDto: UpdateChecklistDTO,
  ) {
    return this.checklistsService.update(id, user.id, updateChecklistDto);
  }

  @Delete(':id')
  async delete(@Param('id') id: string, @CurrentUser() user: any) {
    return this.checklistsService.delete(id, user.id);
  }

  @Post(':id/items')
  async addItem(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() body: { title: string },
  ) {
    if (!body?.title?.trim()) {
      throw new BadRequestException('title is required');
    }

    return this.checklistsService.addItem(id, user.id, body.title.trim());
  }

  @Put(':id/items/:itemId')
  async updateItem(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @CurrentUser() user: any,
    @Body() updateChecklistItemDto: UpdateChecklistItemDTO,
  ) {
    return this.checklistsService.updateItem(
      id,
      itemId,
      user.id,
      updateChecklistItemDto,
    );
  }

  @Delete(':id/items/:itemId')
  async deleteItem(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @CurrentUser() user: any,
  ) {
    return this.checklistsService.deleteItem(id, itemId, user.id);
  }
}
