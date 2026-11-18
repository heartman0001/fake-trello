import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { BoardMemberGuard } from '../common/guards/board-member.guard';
import { AnalyticsService, type BoardAnalytics } from './analytics.service';

@Controller('boards/:boardId/analytics')
@UseGuards(BoardMemberGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get()
  getBoardAnalytics(
    @Param('boardId') boardId: string,
  ): Promise<BoardAnalytics> {
    return this.analyticsService.getBoardAnalytics(boardId);
  }
}
