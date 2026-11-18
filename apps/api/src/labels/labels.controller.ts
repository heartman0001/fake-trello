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
import { LabelsService } from './labels.service';
import { CreateLabelDTO, UpdateLabelDTO } from '@fake-trello/shared';
import { BoardMemberGuard } from '../common/guards/board-member.guard';

@Controller('boards/:boardId/labels')
@UseGuards(BoardMemberGuard)
export class LabelsController {
  constructor(private labelsService: LabelsService) {}

  @Get()
  async findAll(@Param('boardId') boardId: string) {
    return this.labelsService.findAll(boardId);
  }

  @Post()
  async create(
    @Param('boardId') boardId: string,
    @Body() createLabelDto: CreateLabelDTO,
  ) {
    return this.labelsService.create(boardId, createLabelDto);
  }

  @Put(':id')
  async update(
    @Param('boardId') boardId: string,
    @Param('id') id: string,
    @Body() updateLabelDto: UpdateLabelDTO,
  ) {
    return this.labelsService.update(boardId, id, updateLabelDto);
  }

  @Delete(':id')
  async delete(@Param('boardId') boardId: string, @Param('id') id: string) {
    return this.labelsService.delete(boardId, id);
  }
}
