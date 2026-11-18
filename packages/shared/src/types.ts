/**
 * Shared type definitions for the fake-trello application
 */
import { generateKeyBetween } from 'fractional-indexing';

// Role constants
export enum UserRole {
  OWNER = 'OWNER',
  ADMIN = 'ADMIN',
  MEMBER = 'MEMBER',
}

// Workspace member role type
export type WorkspaceMemberRole = UserRole;

// Activity type constants
export enum ActivityType {
  CARD_CREATED = 'CARD_CREATED',
  CARD_UPDATED = 'CARD_UPDATED',
  CARD_DELETED = 'CARD_DELETED',
  CARD_MOVED = 'CARD_MOVED',
  CARD_COMMENTED = 'CARD_COMMENTED',
  CARD_CHECKLIST_COMPLETED = 'CARD_CHECKLIST_COMPLETED',
  COLUMN_REORDERED = 'COLUMN_REORDERED',
  BOARD_UPDATED = 'BOARD_UPDATED',
  MEMBER_ADDED = 'MEMBER_ADDED',
  MEMBER_REMOVED = 'MEMBER_REMOVED',
}

// User entity
export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

// Workspace entity
export interface Workspace {
  id: string;
  name: string;
  description?: string;
  ownerId: string;
  createdAt: Date;
  updatedAt: Date;
}

// Workspace member entity
export interface WorkspaceMember {
  id: string;
  workspaceId: string;
  userId: string;
  role: WorkspaceMemberRole;
  joinedAt: Date;
}

// Board entity
export interface Board {
  id: string;
  workspaceId: string;
  title: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Column entity
export interface Column {
  id: string;
  boardId: string;
  title: string;
  position: string;
  createdAt: Date;
  updatedAt: Date;
}

// Card entity
export interface Card {
  id: string;
  columnId: string;
  title: string;
  description?: string;
  position: string;
  dueDate?: Date;
  assigneeId?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Label entity
export interface Label {
  id: string;
  boardId: string;
  name: string;
  color: string;
  createdAt: Date;
}

// Card label junction
export interface CardLabel {
  id: string;
  cardId: string;
  labelId: string;
  createdAt: Date;
}

// Checklist entity
export interface Checklist {
  id: string;
  cardId: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
}

// Checklist item entity
export interface ChecklistItem {
  id: string;
  checklistId: string;
  title: string;
  completed: boolean;
  position: number;
  createdAt: Date;
  updatedAt: Date;
}

// Comment entity
export interface Comment {
  id: string;
  cardId: string;
  userId: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

// Activity log entity
export interface ActivityLog {
  id: string;
  boardId: string;
  userId: string;
  type: ActivityType;
  metadata: Record<string, any>;
  createdAt: Date;
}

export interface BoardMember {
  id: string;
  userId: string;
  role: WorkspaceMemberRole;
  user: Pick<User, 'id' | 'name' | 'email'>;
}

// Board with full relationships (for API responses)
export interface BoardWithRelations {
  id: string;
  workspaceId: string;
  title: string;
  description?: string | null;
  columns: ColumnWithRelations[];
  labels?: Label[];
  members?: BoardMember[];
  workspaceName?: string;
  workspaceMemberRole?: WorkspaceMemberRole;
  createdAt: Date;
  updatedAt: Date;
}

export interface ColumnWithRelations {
  id: string;
  boardId: string;
  title: string;
  position: string;
  cards: CardWithRelations[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CardLabelWithLabel extends CardLabel {
  label: Label;
}

export interface CommentWithUser extends Comment {
  user: Pick<User, 'id' | 'name' | 'email'>;
}

export interface CardWithRelations {
  id: string;
  columnId: string;
  title: string;
  description?: string | null;
  position: string;
  dueDate?: Date | null;
  assigneeId?: string | null;
  assignee?: Pick<User, 'id' | 'name' | 'email'> | null;
  labels: CardLabelWithLabel[];
  checklist: ChecklistWithRelations | null;
  comments: CommentWithUser[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ChecklistWithRelations {
  id: string;
  cardId: string;
  title: string;
  items: ChecklistItem[];
  createdAt: Date;
  updatedAt: Date;
}

// WebSocket event types
export interface SocketEvent {
  event: string;
  data: any;
}

export const SocketEvents = {
  CARD_CREATED: 'card:created',
  CARD_UPDATED: 'card:updated',
  CARD_DELETED: 'card:deleted',
  CARD_MOVED: 'card:moved',
  CARD_COMMENTED: 'card:commented',
  COLUMN_REORDERED: 'column:reordered',
  BOARD_UPDATED: 'board:updated',
  BOARD_MEMBER_ADDED: 'board:member:added',
  BOARD_MEMBER_REMOVED: 'board:member:removed',
  ACTIVITY_LOGGED: 'activity:logged',
} as const;

// Fractional indexing utilities (rocicorp/fractional-indexing compatible)
export class FractionalIndex {
  static after(index: string | null): string {
    return generateKeyBetween(index, null);
  }

  static before(index: string | null): string {
    return generateKeyBetween(null, index);
  }

  static between(before: string | null, after: string | null): string {
    return generateKeyBetween(before, after);
  }
}