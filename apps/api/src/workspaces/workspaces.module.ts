import { Module } from '@nestjs/common';
import { WorkspacesService } from './workspaces.service';
import { WorkspacesController } from './workspaces.controller';
import { BoardMemberGuard } from '../common/guards/board-member.guard';

@Module({
  controllers: [WorkspacesController],
  providers: [WorkspacesService, BoardMemberGuard],
  exports: [WorkspacesService],
})
export class WorkspacesModule {}
