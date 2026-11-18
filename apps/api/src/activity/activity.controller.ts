import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ActivityService } from './activity.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { BoardMemberGuard } from '../common/guards/board-member.guard';

@Controller('boards/:boardId/activity')
@UseGuards(BoardMemberGuard)
export class ActivityController {
  constructor(private activityService: ActivityService) {}

  @Get()
  async findByBoard(@Param('boardId') boardId: string, @CurrentUser() user: any) {
    return this.activityService.findByBoard(boardId);
  }
}
