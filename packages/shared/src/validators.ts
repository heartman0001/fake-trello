/**
 * Shared Zod validators
 */

import { z } from 'zod';

// Common validators
export const EmailSchema = z.string().email('Invalid email address');
export const NonEmptyStringSchema = z.string().min(1, 'Field is required');
export const OptionalNonEmptyStringSchema = z.string().min(1).optional().or(z.literal(''));
export const OptionalStringSchema = z.string().optional();

// User validators
export const CreateUserSchema = z.object({
  email: EmailSchema,
  name: NonEmptyStringSchema,
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const UpdateUserSchema = z.object({
  name: OptionalNonEmptyStringSchema,
});

export const LoginSchema = z.object({
  email: EmailSchema,
  password: NonEmptyStringSchema,
});

const AvatarLogoSchema = z
  .string()
  .max(300_000, 'Profile image is too large')
  .refine(
    (value) =>
      value === '' ||
      /^data:image\/(png|jpe?g|webp);base64,/i.test(value) ||
      /^https?:\/\//i.test(value),
    'Profile image must be an image URL or an uploaded image',
  );

export const UpdateProfileSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(80, 'Name is too long'),
  avatarUrl: AvatarLogoSchema.nullable().optional(),
});

export const ChangePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .max(128, 'Password is too long'),
  })
  .refine((value) => value.currentPassword !== value.newPassword, {
    message: 'New password must be different from the current password',
    path: ['newPassword'],
  });

// Workspace validators
export const CreateWorkspaceSchema = z.object({
  name: NonEmptyStringSchema,
  description: OptionalStringSchema,
});

export const UpdateWorkspaceSchema = z.object({
  name: OptionalNonEmptyStringSchema,
  description: OptionalStringSchema,
});

// Board validators
export const CreateBoardSchema = z.object({
  workspaceId: NonEmptyStringSchema,
  title: NonEmptyStringSchema,
  description: OptionalStringSchema,
});

export const UpdateBoardSchema = z.object({
  title: OptionalNonEmptyStringSchema,
  description: OptionalStringSchema,
});

// Column validators
export const CreateColumnSchema = z.object({
  boardId: NonEmptyStringSchema,
  title: NonEmptyStringSchema,
});

export const UpdateColumnSchema = z.object({
  title: OptionalNonEmptyStringSchema,
});

// Card validators
export const CreateCardSchema = z.object({
  columnId: NonEmptyStringSchema,
  title: NonEmptyStringSchema,
  description: OptionalStringSchema,
  position: OptionalStringSchema,
  dueDate: z.string().datetime().optional(),
  assigneeId: OptionalStringSchema,
});

export const UpdateCardSchema = z.object({
  title: OptionalNonEmptyStringSchema,
  description: OptionalStringSchema,
  dueDate: z.string().datetime().optional(),
  assigneeId: OptionalStringSchema,
});

// Label validators
export const CreateLabelSchema = z.object({
  boardId: NonEmptyStringSchema,
  name: NonEmptyStringSchema,
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid color format (use hex)'),
});

export const UpdateLabelSchema = z.object({
  name: OptionalNonEmptyStringSchema,
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid color format (use hex)').optional(),
});

// Comment validators
export const CreateCommentSchema = z.object({
  cardId: NonEmptyStringSchema,
  content: NonEmptyStringSchema,
});

export const UpdateCommentSchema = z.object({
  content: NonEmptyStringSchema,
});

// Checklist validators
export const CreateChecklistSchema = z.object({
  cardId: NonEmptyStringSchema,
  title: NonEmptyStringSchema,
});

export const UpdateChecklistSchema = z.object({
  title: OptionalNonEmptyStringSchema,
});

// Checklist item validators
export const CreateChecklistItemSchema = z.object({
  checklistId: NonEmptyStringSchema,
  title: NonEmptyStringSchema,
  completed: z.boolean().optional(),
  position: z.number().int().positive().optional(),
});

export const UpdateChecklistItemSchema = z.object({
  title: OptionalNonEmptyStringSchema,
  completed: z.boolean().optional(),
  position: z.number().int().positive().optional(),
});

// Activity log validators
export const CreateActivityLogSchema = z.object({
  boardId: NonEmptyStringSchema,
  userId: NonEmptyStringSchema,
  type: z.enum([
    'CARD_CREATED',
    'CARD_UPDATED',
    'CARD_DELETED',
    'CARD_MOVED',
    'CARD_COMMENTED',
    'CARD_CHECKLIST_COMPLETED',
    'COLUMN_REORDERED',
    'BOARD_UPDATED',
    'MEMBER_ADDED',
    'MEMBER_REMOVED',
  ]),
  metadata: z.record(z.any()),
});

// Pagination validators
export const PaginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});

export type CreateUserDTO = z.infer<typeof CreateUserSchema>;
export type UpdateUserDTO = z.infer<typeof UpdateUserSchema>;
export type LoginDTO = z.infer<typeof LoginSchema>;
export type UpdateProfileDTO = z.infer<typeof UpdateProfileSchema>;
export type ChangePasswordDTO = z.infer<typeof ChangePasswordSchema>;
export type CreateWorkspaceDTO = z.infer<typeof CreateWorkspaceSchema>;
export type UpdateWorkspaceDTO = z.infer<typeof UpdateWorkspaceSchema>;
export type CreateBoardDTO = z.infer<typeof CreateBoardSchema>;
export type UpdateBoardDTO = z.infer<typeof UpdateBoardSchema>;
export type CreateColumnDTO = z.infer<typeof CreateColumnSchema>;
export type UpdateColumnDTO = z.infer<typeof UpdateColumnSchema>;
export type CreateCardDTO = z.infer<typeof CreateCardSchema>;
export type UpdateCardDTO = z.infer<typeof UpdateCardSchema>;
export type CreateLabelDTO = z.infer<typeof CreateLabelSchema>;
export type UpdateLabelDTO = z.infer<typeof UpdateLabelSchema>;
export type CreateCommentDTO = z.infer<typeof CreateCommentSchema>;
export type UpdateCommentDTO = z.infer<typeof UpdateCommentSchema>;
export type CreateChecklistDTO = z.infer<typeof CreateChecklistSchema>;
export type UpdateChecklistDTO = z.infer<typeof UpdateChecklistSchema>;
export type CreateChecklistItemDTO = z.infer<typeof CreateChecklistItemSchema>;
export type UpdateChecklistItemDTO = z.infer<typeof UpdateChecklistItemSchema>;
export type CreateActivityLogDTO = z.infer<typeof CreateActivityLogSchema>;
export type PaginationParams = z.infer<typeof PaginationSchema>;
