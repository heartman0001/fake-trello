import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { CardsService } from './cards.service';
import { CreateCardDTO, UpdateCardDTO } from '@fake-trello/shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { BoardMemberGuard } from '../common/guards/board-member.guard';

@Controller('boards/:boardId/columns/:columnId/cards')
@UseGuards(BoardMemberGuard)
export class CardsController {
  constructor(private cardsService: CardsService) {}

  @Get()
  async findAll(
    @Param('boardId') boardId: string,
    @Param('columnId') columnId: string,
  ) {
    return this.cardsService.findAll(boardId, columnId);
  }

  @Post()
  async create(
    @Param('boardId') boardId: string,
    @Param('columnId') columnId: string,
    @CurrentUser() user: any,
    @Body() createCardDto: CreateCardDTO,
  ) {
    return this.cardsService.create(boardId, columnId, user.id, createCardDto);
  }

  @Get(':id')
  async findById(
    @Param('boardId') boardId: string,
    @Param('columnId') columnId: string,
    @Param('id') id: string,
  ) {
    return this.cardsService.findById(boardId, columnId, id);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() updateCardDto: UpdateCardDTO,
  ) {
    return this.cardsService.update(id, user.id, updateCardDto);
  }

  @Delete(':id')
  async delete(@Param('id') id: string, @CurrentUser() user: any) {
    return this.cardsService.delete(id, user.id);
  }

  @Post(':cardId/move')
  async move(
    @Param('boardId') boardId: string,
    @Param('columnId') columnId: string,
    @Param('cardId') cardId: string,
    @CurrentUser() user: any,
    @Body() body: { targetColumnId: string; position?: string | null },
  ) {
    return this.cardsService.move(
      boardId,
      columnId,
      cardId,
      user.id,
      body.targetColumnId,
      body.position ?? null,
    );
  }

  @Post(':cardId/labels/:labelId')
  async addLabel(
    @Param('boardId') boardId: string,
    @Param('columnId') columnId: string,
    @Param('cardId') cardId: string,
    @Param('labelId') labelId: string,
    @CurrentUser() user: any,
  ) {
    return this.cardsService.addLabel(boardId, columnId, cardId, labelId, user.id);
  }

  @Delete(':cardId/labels/:labelId')
  async removeLabel(
    @Param('boardId') boardId: string,
    @Param('columnId') columnId: string,
    @Param('cardId') cardId: string,
    @Param('labelId') labelId: string,
    @CurrentUser() user: any,
  ) {
    return this.cardsService.removeLabel(
      boardId,
      columnId,
      cardId,
      labelId,
      user.id,
    );
  }
}
