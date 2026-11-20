import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ColumnsService } from './columns.service';
import { CreateColumnDTO, UpdateColumnDTO } from '@fake-trello/shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { BoardMemberGuard } from '../common/guards/board-member.guard';

@Controller('boards/:boardId/columns')
@UseGuards(BoardMemberGuard)
export class ColumnsController {
  constructor(private columnsService: ColumnsService) {}

  @Get()
  async findAll(@Param('boardId') boardId: string, @CurrentUser() user: any) {
    return this.columnsService.findAll(boardId);
  }

  @Post()
  async create(
    @Param('boardId') boardId: string,
    @CurrentUser() user: any,
    @Body() createColumnDto: CreateColumnDTO,
  ) {
    return this.columnsService.create(boardId, user.id, createColumnDto);
  }

  @Get(':id')
  async findById(@Param('boardId') boardId: string, @Param('id') id: string) {
    return this.columnsService.findById(boardId, id);
  }

  @Put(':id')
  async update(
    @Param('boardId') boardId: string,
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() updateColumnDto: UpdateColumnDTO,
  ) {
    return this.columnsService.update(boardId, id, user.id, updateColumnDto);
  }

  @Delete(':id')
  async delete(
    @Param('boardId') boardId: string,
    @Param('id') id: string,
    @CurrentUser() user: any,
  ) {
    return this.columnsService.delete(boardId, id, user.id);
  }

  @Post('reorder')
  async reorder(
    @Param('boardId') boardId: string,
    @CurrentUser() user: any,
    @Body() body: { columnIds: string[] },
  ) {
    return this.columnsService.reorder(boardId, user.id, body.columnIds);
  }
}
