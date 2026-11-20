-- Optional profile image. Uploaded images are stored as compressed data URLs,
-- so this column can contain either an https URL or a data:image/* URL.
ALTER TABLE "users" ADD COLUMN "avatarUrl" TEXT;
