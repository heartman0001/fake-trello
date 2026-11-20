import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma.service';
import {
  ChangePasswordDTO,
  CreateUserDTO,
  JWT_CONFIG,
  LoginDTO,
  UpdateProfileDTO,
} from '@fake-trello/shared';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private config: ConfigService,
  ) {}

  async register(createUserDto: CreateUserDTO) {
    const { email, name, password } = createUserDto;

    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await this.prisma.user.create({
      data: {
        email,
        name,
        password: hashedPassword,
      },
    });

    const { password: _, ...userWithoutPassword } = user;

    const tokens = await this.generateTokens(user.id, user.email);

    return {
      user: userWithoutPassword,
      ...tokens,
    };
  }

  async login(loginDto: LoginDTO) {
    const { email, password } = loginDto;

    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const { password: _, ...userWithoutPassword } = user;

    const tokens = await this.generateTokens(user.id, user.email);

    return {
      user: userWithoutPassword,
      ...tokens,
    };
  }

  async refreshTokens(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.refreshSecret,
      });

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      });

      if (!user) {
        throw new UnauthorizedException();
      }

      const tokens = await this.generateTokens(user.id, user.email);

      return tokens;
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async validateUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, avatarUrl: true },
    });

    if (!user) {
      throw new UnauthorizedException();
    }

    return user;
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: this.publicUserSelect,
    });

    if (!user) {
      throw new UnauthorizedException();
    }

    return user;
  }

  async updateProfile(userId: string, updateProfileDto: UpdateProfileDTO) {
    const avatarUrl =
      updateProfileDto.avatarUrl === undefined
        ? undefined
        : updateProfileDto.avatarUrl?.trim() || null;

    return this.prisma.user.update({
      where: { id: userId },
      data: {
        name: updateProfileDto.name,
        ...(avatarUrl !== undefined ? { avatarUrl } : {}),
      },
      select: this.publicUserSelect,
    });
  }

  async changePassword(userId: string, body: ChangePasswordDTO) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, password: true },
    });

    if (!user) {
      throw new UnauthorizedException();
    }

    const isValid = await bcrypt.compare(body.currentPassword, user.password);

    if (!isValid) {
      throw new BadRequestException('Current password is incorrect');
    }

    const hashedPassword = await bcrypt.hash(body.newPassword, 12);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    });

    return { success: true };
  }

  private readonly publicUserSelect = {
    id: true,
    email: true,
    name: true,
    avatarUrl: true,
    createdAt: true,
    updatedAt: true,
  } as const;

  /**
   * Paginated invite candidate search. When `boardId` is provided, users that
   * already belong to that board are excluded in the database. Results are
   * ranked: exact email, then prefix match, then substring match, then name.
   */
  async getAllUsers({
    currentUserId,
    boardId,
    search,
    page = 1,
    limit = 20,
  }: {
    currentUserId: string;
    boardId?: string | null;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const query = search?.trim() ?? '';
    const safeLimit = Math.min(Math.max(limit, 1), 50);
    const safePage = Math.max(page, 1);
    const offset = (safePage - 1) * safeLimit;
    const excludedBoardId = boardId ?? null;

    // Fetch one extra row to know whether another page exists.
    const rows = await this.prisma.$queryRaw<
      { id: string; name: string; email: string }[]
    >`
      SELECT u.id, u.name, u.email
      FROM users u
      WHERE u.id <> ${currentUserId}
        AND (u.name ILIKE '%' || ${query} || '%' OR u.email ILIKE '%' || ${query} || '%')
        AND (
          ${excludedBoardId}::text IS NULL
          OR NOT EXISTS (
            SELECT 1
            FROM board_members bm
            WHERE bm."boardId" = ${excludedBoardId}
              AND bm."userId" = u.id
          )
        )
      ORDER BY
        CASE
          WHEN lower(u.email) = lower(${query}) THEN 0
          WHEN lower(u.name) LIKE lower(${query}) || '%' THEN 1
          WHEN lower(u.email) LIKE lower(${query}) || '%' THEN 1
          ELSE 2
        END,
        lower(u.name) ASC,
        u.id ASC
      OFFSET ${offset} LIMIT ${safeLimit + 1}
    `;

    const hasMore = rows.length > safeLimit;

    return {
      items: hasMore ? rows.slice(0, safeLimit) : rows,
      page: safePage,
      limit: safeLimit,
      hasMore,
    };
  }

  private async generateTokens(userId: string, email: string) {
    const payload = { sub: userId, email, role: 'MEMBER' };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.accessSecret,
        expiresIn: this.accessExpiry,
      }),
      this.jwtService.signAsync(payload, {
        secret: this.refreshSecret,
        expiresIn: this.refreshExpiry,
      }),
    ]);

    return {
      accessToken,
      refreshToken,
    };
  }

  private get accessSecret(): string {
    return (
      this.config.get<string>('JWT_ACCESS_TOKEN_SECRET') ||
      this.config.get<string>('JWT_SECRET') ||
      JWT_CONFIG.ACCESS_TOKEN_SECRET
    );
  }

  private get refreshSecret(): string {
    return (
      this.config.get<string>('JWT_REFRESH_TOKEN_SECRET') ||
      this.config.get<string>('JWT_SECRET') ||
      JWT_CONFIG.REFRESH_TOKEN_SECRET
    );
  }

  private get accessExpiry(): string {
    return (
      this.config.get<string>('JWT_ACCESS_TOKEN_EXPIRY') ||
      this.config.get<string>('JWT_EXPIRES_IN') ||
      JWT_CONFIG.ACCESS_TOKEN_EXPIRY
    );
  }

  private get refreshExpiry(): string {
    return (
      this.config.get<string>('JWT_REFRESH_TOKEN_EXPIRY') ||
      JWT_CONFIG.REFRESH_TOKEN_EXPIRY
    );
  }
}
