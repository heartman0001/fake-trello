import { ConfigService } from '@nestjs/config';
import { JWT_CONFIG } from '@fake-trello/shared';

export const getAccessSecret = (config: ConfigService): string =>
  config.get<string>('JWT_ACCESS_TOKEN_SECRET') ||
  config.get<string>('JWT_SECRET') ||
  JWT_CONFIG.ACCESS_TOKEN_SECRET;

export const getRefreshSecret = (config: ConfigService): string =>
  config.get<string>('JWT_REFRESH_TOKEN_SECRET') ||
  config.get<string>('JWT_SECRET') ||
  JWT_CONFIG.REFRESH_TOKEN_SECRET;
