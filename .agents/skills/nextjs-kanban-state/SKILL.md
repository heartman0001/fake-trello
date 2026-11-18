---
name: nextjs-kanban-state
description: Client state management, optimistic drag-and-drop, and WebSocket sync for Next.js Kanban UI. Use when implementing @dnd-kit, TanStack Query mutations, Zustand drag states, or card modals.
---

# Next.js Kanban State & Interaction Rules

## 1. State Separation
- Use **TanStack Query (React Query)** as the single source of truth for server-synced board data.
- Use **Zustand** (or local state) strictly for transient UI/drag states (`activeCard`, `activeColumn`, `isDragging`).

## 2. Optimistic Drag-and-Drop
- Every drag-and-drop mutation (`moveCard`, `reorderColumn`) MUST implement **Optimistic Updates** in `useMutation`:
  1. Cancel outgoing refetches in `onMutate`.
  2. Snapshot previous cache state.
  3. Immediately update the TanStack Query cache with the new fractional `position`.
  4. Rollback to the snapshot in `onError` if the NestJS API fails.

## 3. Real-time Concurrency
- Queue or ignore incoming WebSocket `board:updated` / `card:moved` events while `isDragging === true` on the client to prevent cards from snapping back or flickering mid-drag. Apply queued updates once `onDragEnd` completes.

## 4. Routing & Auto-save
- Implement Card Detail Modals using Next.js App Router Intercepting Routes (`@modal/(.)cards/[id]`) so every card has a direct, shareable URL.
- Debounce text inputs inside Card Modals (title, description) by 500ms instead of requiring a manual "Save" button.