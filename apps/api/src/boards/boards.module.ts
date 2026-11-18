import { Module } from '@nestjs/common';
import { BoardsService } from './boards.service';
import { BoardsController } from './boards.controller';
import { BoardMemberGuard } from '../common/guards/board-member.guard';

@Module({
  controllers: [BoardsController],
  providers: [BoardsService, BoardMemberGuard],
  exports: [BoardsService],
})
export class BoardsModule {}
