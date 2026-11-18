import { Body, Controller, Param, Patch } from '@nestjs/common';
import { UpdateCardDTO } from '@fake-trello/shared';
import { CardsService } from './cards.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';

/**
 * Single-card routes used by the card detail surface. Access is checked
 * inside the service, which resolves the card's board and workspace role.
 */
@Controller('cards')
export class CardDetailController {
  constructor(private cardsService: CardsService) {}

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
    @Body() updateCardDto: UpdateCardDTO,
  ) {
    return this.cardsService.update(id, user.id, updateCardDto);
  }
}
