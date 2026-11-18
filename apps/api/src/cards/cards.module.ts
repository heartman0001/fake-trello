import { Module } from '@nestjs/common';
import { CardsService } from './cards.service';
import { CardsController } from './cards.controller';
import { CardDetailController } from './card-detail.controller';
import { BoardMemberGuard } from '../common/guards/board-member.guard';

@Module({
  controllers: [CardsController, CardDetailController],
  providers: [CardsService, BoardMemberGuard],
  exports: [CardsService],
})
export class CardsModule {}
