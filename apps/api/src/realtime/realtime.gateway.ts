import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '../prisma.service';
import { SocketEvents } from '@fake-trello/shared';

interface AuthenticatedSocket extends Socket {
  data: {
    userId?: string;
  };
}

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || true,
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
})
export class RealtimeGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(RealtimeGateway.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  afterInit() {
    this.logger.log('WebSocket gateway initialized');
  }

  async handleConnection(socket: AuthenticatedSocket) {
    const token =
      (socket.handshake.auth?.token as string | undefined) ||
      (socket.handshake.query?.token as string | undefined);

    if (!token) {
      socket.disconnect(true);
      return;
    }

    try {
      const payload = this.jwtService.verify(token);
      socket.data.userId = payload.sub;
      this.logger.log(`Client connected: ${socket.id} (user ${payload.sub})`);
    } catch {
      this.logger.warn(`Rejected socket with invalid token: ${socket.id}`);
      socket.disconnect(true);
    }
  }

  handleDisconnect(socket: Socket) {
    this.logger.log(`Client disconnected: ${socket.id}`);
  }

  @SubscribeMessage('board:join')
  async joinBoardRoom(
    @ConnectedSocket() socket: AuthenticatedSocket,
    @MessageBody() body: { boardId: string },
  ) {
    const userId = socket.data.userId;

    if (!userId || !body?.boardId) {
      return { ok: false };
    }

    const board = await this.prisma.board.findUnique({
      where: { id: body.boardId },
      include: {
        workspace: {
          include: { members: { where: { userId }, select: { id: true } } },
        },
      },
    });

    if (!board) {
      return { ok: false };
    }

    const isOwner = board.workspace.ownerId === userId;
    const isMember = board.workspace.members.length > 0;

    if (!isOwner && !isMember) {
      return { ok: false };
    }

    socket.join(`board:${board.id}`);
    return { ok: true };
  }

  @SubscribeMessage('board:leave')
  leaveBoardRoom(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: { boardId: string },
  ) {
    if (body?.boardId) {
      socket.leave(`board:${body.boardId}`);
    }
    return { ok: true };
  }

  broadcastCardCreated(boardId: string, card: unknown) {
    this.server.to(`board:${boardId}`).emit(SocketEvents.CARD_CREATED, card);
  }

  broadcastCardUpdated(boardId: string, card: unknown) {
    this.server.to(`board:${boardId}`).emit(SocketEvents.CARD_UPDATED, card);
  }

  broadcastCardDeleted(boardId: string, cardId: string) {
    this.server
      .to(`board:${boardId}`)
      .emit(SocketEvents.CARD_DELETED, { id: cardId });
  }

  broadcastCardMoved(boardId: string, card: unknown) {
    this.server.to(`board:${boardId}`).emit(SocketEvents.CARD_MOVED, card);
  }

  broadcastCardCommented(boardId: string, comment: unknown) {
    this.server
      .to(`board:${boardId}`)
      .emit(SocketEvents.CARD_COMMENTED, comment);
  }

  broadcastColumnReordered(boardId: string, columns: unknown[]) {
    this.server
      .to(`board:${boardId}`)
      .emit(SocketEvents.COLUMN_REORDERED, columns);
  }

  broadcastBoardUpdated(boardId: string, board: unknown) {
    this.server.to(`board:${boardId}`).emit(SocketEvents.BOARD_UPDATED, board);
  }

  broadcastActivityLogged(boardId: string, activity: unknown) {
    this.server
      .to(`board:${boardId}`)
      .emit(SocketEvents.ACTIVITY_LOGGED, activity);
  }
}
