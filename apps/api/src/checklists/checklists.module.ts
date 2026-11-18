import { Module } from "@nestjs/common";
import { ChecklistsService } from "./checklists.service";
import { ChecklistsController } from "./checklists.controller";
import { BoardMemberGuard } from "../common/guards/board-member.guard";

@Module({
  controllers: [ChecklistsController],
  providers: [ChecklistsService, BoardMemberGuard],
  exports: [ChecklistsService],
})
export class ChecklistsModule {}
