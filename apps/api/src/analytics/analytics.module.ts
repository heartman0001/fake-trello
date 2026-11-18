import { Module } from '@nestjs/common';
import { BoardMemberGuard } from '../common/guards/board-member.guard';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';

@Module({
  controllers: [AnalyticsController],
  providers: [AnalyticsService, BoardMemberGuard],
})
export class AnalyticsModule {}
