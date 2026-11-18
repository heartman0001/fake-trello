import { Module } from "@nestjs/common";
import { CommentsService } from "./comments.service";
import { CommentsController } from "./comments.controller";
import { BoardMemberGuard } from "../common/guards/board-member.guard";

@Module({
  controllers: [CommentsController],
  providers: [CommentsService, BoardMemberGuard],
  exports: [CommentsService],
})
export class CommentsModule {}
