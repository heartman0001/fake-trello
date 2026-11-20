import {
  BadRequestException,
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { BoardMemberGuard } from '../common/guards/board-member.guard';

/**
 * Authenticated user lookup used by the board invite modal. Kept separate from
 * AuthController, which is public as a whole. Passing `boardId` verifies board
 * access and excludes existing board members from the result.
 */
@Controller('auth')
@UseGuards(BoardMemberGuard)
export class UsersController {
  constructor(private authService: AuthService) {}

  @Get('users')
  search(
    @CurrentUser() user: { id: string },
    @Query('search') search?: string,
    @Query('boardId') boardId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const scopedBoardId = boardId?.trim();

    if (!scopedBoardId) {
      throw new BadRequestException('boardId is required');
    }

    return this.authService.getAllUsers({
      currentUserId: user.id,
      boardId: scopedBoardId,
      search,
      page: Number(page) || 1,
      limit: Number(limit) || 20,
    });
  }
}
