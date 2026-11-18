import { Module } from "@nestjs/common";
import { LabelsService } from "./labels.service";
import { LabelsController } from "./labels.controller";
import { BoardMemberGuard } from "../common/guards/board-member.guard";

@Module({
  controllers: [LabelsController],
  providers: [LabelsService, BoardMemberGuard],
  exports: [LabelsService],
})
export class LabelsModule {}
