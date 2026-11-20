import { Controller, Get, Post, Put, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { BoardsService } from './boards.service';
import { CreateBoardDTO, UpdateBoardDTO } from '@fake-trello/shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { BoardMemberGuard } from '../common/guards/board-member.guard';

@Controller('boards')
@UseGuards(BoardMemberGuard)
export class BoardsController {
  constructor(private boardsService: BoardsService) {}

  @Get()
  async findAll(@CurrentUser() user: any) {
    return this.boardsService.findAll(user.id);
  }

  @Get(':id')
  async findById(@Param('id') id: string, @CurrentUser() user: any) {
    return this.boardsService.findById(id, user.id);
  }

  @Post()
  async create(@CurrentUser() user: any, @Body() createBoardDto: CreateBoardDTO) {
    return this.boardsService.create(user.id, createBoardDto);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() updateBoardDto: UpdateBoardDTO,
  ) {
    return this.boardsService.update(id, user.id, updateBoardDto);
  }

  @Delete(':id')
  async delete(@Param('id') id: string, @CurrentUser() user: any) {
    return this.boardsService.delete(id, user.id);
  }

  @Post(':id/members')
  async addMember(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() body: { userId: string; role: string },
  ) {
    return this.boardsService.addMember(id, user.id, body.userId, body.role);
  }

  @Delete(':boardId/members/:userId')
  async removeMember(
    @Param('boardId') boardId: string,
    @CurrentUser() user: any,
    @Param('userId') userId: string,
  ) {
    return this.boardsService.removeMember(boardId, user.id, userId);
  }

  @Get(':id/members')
  async getMembers(@Param('id') id: string) {
    return this.boardsService.getMembers(id);
  }
}
