import { Module } from "@nestjs/common";
import { ActivityService } from "./activity.service";
import { ActivityController } from "./activity.controller";
import { BoardMemberGuard } from "../common/guards/board-member.guard";

@Module({
  controllers: [ActivityController],
  providers: [ActivityService, BoardMemberGuard],
  exports: [ActivityService],
})
export class ActivityModule {}
