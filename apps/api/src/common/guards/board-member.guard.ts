import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { UserRole } from '@fake-trello/shared';

/**
 * Verifies that the authenticated user is the owner of, or a member of, the
 * workspace that owns the board referenced by the request. Runs after
 * JwtAuthGuard, so request.user is already populated.
 *
 * Board id is read from `:boardId`, `:id` (boards routes) or `body.boardId`.
 */
@Injectable()
export class BoardMemberGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const userId = request.user?.id;

    if (!userId) {
      throw new ForbiddenException('Authentication required');
    }

    const boardId =
      request.params?.boardId || request.params?.id || request.body?.boardId;

    // Routes without a concrete board (e.g. GET /boards) are covered by JWT
    // auth and filtered by user in the service layer.
    if (!boardId) {
      return true;
    }

    const board = await this.prisma.board.findUnique({
      where: { id: boardId },
      include: {
        workspace: {
          include: {
            members: { where: { userId }, select: { role: true } },
          },
        },
      },
    });

    if (!board) {
      throw new ForbiddenException('Board not found');
    }

    const isOwner = board.workspace.ownerId === userId;
    const memberRole = board.workspace.members[0]?.role;

    if (!isOwner && !memberRole) {
      throw new ForbiddenException('You do not have access to this board');
    }

    request.boardId = board.id;
    request.user.role = isOwner ? UserRole.OWNER : memberRole;

    return true;
  }
}
