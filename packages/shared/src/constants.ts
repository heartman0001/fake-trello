/**
 * Shared constants and configuration
 */

// Role constants
export const Role = {
  OWNER: 'OWNER',
  ADMIN: 'ADMIN',
  MEMBER: 'MEMBER',
} as const;

export type Role = typeof Role[keyof typeof Role];

// Activity type constants
export const ActivityType = {
  CARD_CREATED: 'CARD_CREATED',
  CARD_UPDATED: 'CARD_UPDATED',
  CARD_DELETED: 'CARD_DELETED',
  CARD_MOVED: 'CARD_MOVED',
  CARD_COMMENTED: 'CARD_COMMENTED',
  CARD_CHECKLIST_COMPLETED: 'CARD_CHECKLIST_COMPLETED',
  COLUMN_REORDERED: 'COLUMN_REORDERED',
  BOARD_UPDATED: 'BOARD_UPDATED',
  MEMBER_ADDED: 'MEMBER_ADDED',
  MEMBER_REMOVED: 'MEMBER_REMOVED',
} as const;

export type ActivityType = typeof ActivityType[keyof typeof ActivityType];

// WebSocket events
export const SocketEvents = {
  // Card events
  CARD_CREATED: 'card:created',
  CARD_UPDATED: 'card:updated',
  CARD_DELETED: 'card:deleted',
  CARD_MOVED: 'card:moved',
  CARD_COMMENTED: 'card:commented',
  
  // Column events
  COLUMN_REORDERED: 'column:reordered',
  
  // Board events
  BOARD_UPDATED: 'board:updated',
  BOARD_MEMBER_ADDED: 'board:member:added',
  BOARD_MEMBER_REMOVED: 'board:member:removed',
  
  // Activity events
  ACTIVITY_LOGGED: 'activity:logged',
} as const;

// Default colors for labels
export const LabelColors = [
  '#ff595e', // Red
  '#ffca3a', // Yellow
  '#8ac926', // Green
  '#1982c4', // Blue
  '#6a4c93', // Purple
  '#f15bb5', // Pink
  '#00bbf9', // Cyan
  '#00f5d4', // Teal
] as const;

// JWT configuration
export const JWT_CONFIG = {
  ACCESS_TOKEN_SECRET: process.env.JWT_ACCESS_TOKEN_SECRET || 'your-secret-key-change-in-production',
  ACCESS_TOKEN_EXPIRY: '7d',
  REFRESH_TOKEN_SECRET: process.env.JWT_REFRESH_TOKEN_SECRET || 'your-refresh-secret-key-change-in-production',
  REFRESH_TOKEN_EXPIRY: '30d',
} as const;

// Pagination configuration
export const PAGINATION_CONFIG = {
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
} as const;

// API configuration
export const API_CONFIG = {
  API_PREFIX: '/api',
} as const;

// WebSocket configuration
export const WS_CONFIG = {
  PORT: 3001,
  ORIGINS: '*',
  PING_INTERVAL: 30000,
  PING_TIMEOUT: 5000,
} as const;
