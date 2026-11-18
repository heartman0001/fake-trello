import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma.service';
import { CreateUserDTO, LoginDTO, JWT_CONFIG } from '@fake-trello/shared';
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
      select: { id: true, email: true, name: true },
    });

    if (!user) {
      throw new UnauthorizedException();
    }

    return user;
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
