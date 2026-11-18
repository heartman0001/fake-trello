---
name: nestjs-postgres-architect
description: Backend architecture, PostgreSQL schema, and NestJS API rules for Kanban system. Use when creating or modifying NestJS modules, DTOs, Guards, WebSockets, or PostgreSQL database schemas.
---

# NestJS & PostgreSQL Architecture Rules

## 1. Modular Structure
- Strictly separate `Controller` (HTTP routing & request/response handling), `Service` (Business Logic), and ORM/Repository layer.
- Never put raw database queries or complex business logic inside controllers.

## 2. Ordering Logic (Fractional Indexing)
- Always use string-based **Fractional Indexing** (`position: string` / PostgreSQL `TEXT`) for ordering `Columns` and `Cards` (e.g., using `fractional-indexing` library).
- Never use integer auto-increment (`1, 2, 3`) for sortable positions or re-index an entire column on a single card move.

## 3. Transactions & Data Integrity
- Wrap multi-table mutations (e.g., moving a card between columns + creating an `ActivityLog` entry) inside a database transaction (`$transaction`).
- Always index foreign keys (`boardId`, `columnId`, `assigneeId`) in PostgreSQL for fast board queries.

## 4. Validation, Security & Real-time
- Validate all incoming payloads using `class-validator` and `class-transformer` DTOs.
- Protect all board, column, and card endpoints with a `BoardMemberGuard` to verify workspace/board permissions before executing mutations.
- Emit Socket.io events to `board:${boardId}` room *after* the database transaction commits. Use `socket.to(room).emit(...)` to exclude the sender's socket ID and prevent duplicate updates.