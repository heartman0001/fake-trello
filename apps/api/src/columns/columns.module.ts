import { Module } from '@nestjs/common';
import { ColumnsService } from './columns.service';
import { ColumnsController } from './columns.controller';
import { BoardMemberGuard } from '../common/guards/board-member.guard';

@Module({
  controllers: [ColumnsController],
  providers: [ColumnsService, BoardMemberGuard],
  exports: [ColumnsService],
})
export class ColumnsModule {}
