import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { CommentsService } from './comments.service';
import { CreateCommentDTO, UpdateCommentDTO } from '@fake-trello/shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { BoardMemberGuard } from '../common/guards/board-member.guard';

@Controller('boards/:boardId/columns/:columnId/cards/:cardId/comments')
@UseGuards(BoardMemberGuard)
export class CommentsController {
  constructor(private commentsService: CommentsService) {}

  @Get()
  async findAll(
    @Param('boardId') boardId: string,
    @Param('columnId') columnId: string,
    @Param('cardId') cardId: string,
  ) {
    return this.commentsService.findAll(boardId, columnId, cardId);
  }

  @Post()
  async create(
    @Param('boardId') boardId: string,
    @Param('columnId') columnId: string,
    @Param('cardId') cardId: string,
    @CurrentUser() user: any,
    @Body() createCommentDto: CreateCommentDTO,
  ) {
    return this.commentsService.create(
      boardId,
      columnId,
      cardId,
      user.id,
      createCommentDto,
    );
  }

  @Get(':id')
  async findById(
    @Param('boardId') boardId: string,
    @Param('columnId') columnId: string,
    @Param('cardId') cardId: string,
    @Param('id') id: string,
  ) {
    return this.commentsService.findById(boardId, columnId, cardId, id);
  }

  @Put(':id')
  async update(@Param('id') id: string, @CurrentUser() user: any, @Body() updateCommentDto: UpdateCommentDTO) {
    return this.commentsService.update(id, user.id, updateCommentDto);
  }

  @Delete(':id')
  async delete(@Param('id') id: string, @CurrentUser() user: any) {
    return this.commentsService.delete(id, user.id);
  }
}
