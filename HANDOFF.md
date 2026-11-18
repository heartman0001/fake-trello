# Fake Trello - Project Handoff Document

## Project Overview

**Project Name:** Fake Trello  
**Type:** Real-time Kanban Board Application  
**Architecture:** Monorepo with Next.js (App Router) + NestJS Backend + PostgreSQL  
**Current Status:** Core backend, Kanban UI, card detail routes, realtime client, and board analytics are implemented, building, and running end-to-end against PostgreSQL (Docker Compose). Interactive browser verification is still pending.

---

## Tech Stack

### Frontend
- Next.js 14 (App Router, parallel + intercepting routes) + Tailwind CSS
- Zustand (client state) + TanStack Query (server state)
- @dnd-kit (drag & drop), socket.io-client (realtime)
- Axios + cookies-next for the API client
- Custom responsive SVG charts (no chart library dependency)

### Backend
- NestJS 10, Prisma + PostgreSQL, Socket.io
- JWT (Passport) with a global `JwtAuthGuard`
- Board/workspace membership checks via `BoardMemberGuard`
- Fractional indexing for ordering
- PostgreSQL CTE / window-function aggregation for analytics

### Shared
- pnpm workspace (`pnpm-workspace.yaml`) + `@fake-trello/shared` types/validators

---

## What Is Done

### Backend
- `auth` — register/login/refresh, JWT secrets resolved from `.env` through `ConfigService`
- `workspaces` — CRUD + members, access checks
- `boards` — list/detail/create/update/delete; detail returns columns → cards → labels/checklist/comments/assignee and board members
- `columns` — CRUD + reorder (positions recalculated server-side)
- `cards` — CRUD, move, add/remove labels, activity logging + socket broadcasts
- `cards` detail endpoint — `PATCH /api/cards/:id` used by the card modal auto-save; access is checked against the card's board inside `CardsService`
- `labels` — CRUD scoped to a board
- `comments` — CRUD with ownership checks
- `checklists` — one per card, item add/update/delete
- `activity` — list board activity
- `analytics` — `GET /api/boards/:boardId/analytics`, protected by `BoardMemberGuard`
  - Lead time (average + p85 hours)
  - Cycle time (average + p85 hours)
  - WIP counts per column and active WIP total
  - Weekly throughput over the last 8 weeks
  - Queries use `prisma.$queryRaw`, CTEs, `ROW_NUMBER`, `MIN(...) OVER`, `AVG(...) OVER`, and `percentile_cont`; no raw activity rows are loaded into Node
- `realtime` — socket.io gateway with JWT handshake auth, `board:join` / `board:leave`, broadcast helpers
- `prisma.service.ts` + global `PrismaModule`; enums added to the Prisma schema
- API is prefixed with `/api`; CORS fixed for credentialed dev requests
- `prisma/seed.ts` rewritten to be valid and idempotent

### Frontend

#### Pages and routing
- Config: `package.json`, `next.config.js`, `tailwind.config.ts`, `postcss.config.js`, `tsconfig.json`
- `middleware.ts` route protection (redirects to `/login`, keeps signed-in users out of auth pages)
- Pages: `/login`, `/register`, `/workspaces`, `/board/[boardId]`, `/board/[boardId]/cards/[cardId]`, `/board/[boardId]/analytics`
- Card detail uses App Router parallel/intercepting routes under the existing `/board/[boardId]` convention:
  - `app/board/[boardId]/layout.tsx` accepts `children` + `@modal`
  - `@modal/(.)cards/[cardId]/page.tsx` renders the modal over the board on client navigation
  - `cards/[cardId]/page.tsx` is the shareable/refresh-safe full-page fallback
- Board header includes a direct “Analytics” link alongside the existing filters

#### Board and card UX
- Auth store (persisted user) + cookie-based access token
- API client matching the real response shape and port 4000
- Board queries/mutations in `hooks/useBoardQueries.ts`, including `useBoardAnalytics`
- Realtime subscription in `hooks/useBoardSocket.ts`
- Components: `BoardHeader`, `BoardCanvas`, `BoardColumn`, `KanbanCard`, card detail modal under `components/card-modal/`
- Working board filters: search, label and due-date (overdue/today/next 7 days)
- Card detail modal:
  - 500 ms debounced auto-save for title and description via `PATCH /cards/:id`
  - Saves are serialized so stale responses cannot overwrite newer typing; pending edits flush on blur/unmount
  - Subtle Saving… / Saved / retry-on-error indicator, no manual Save button
  - Checklist add/toggle/delete with animated progress bar
  - Due date picker, label toggle selector, comment feed and owner-only comment deletion
  - Escape/backdrop close, focus trap, body scroll lock
- Drag & drop: sortable cards (vertical + cross-column) and sortable columns (horizontal) via `@dnd-kit`, PointerSensor (5px) + KeyboardSensor, `DragOverlay` previews, optimistic `useMoveCard` / `useReorderColumn`
- Positions use `fractional-indexing` (`generateKeyBetween`) on both client and server (`FractionalIndex` in shared types)
- Socket events are queued while `isDragging` is true and flushed after drag end to prevent cards snapping back

#### Analytics dashboard
- `/board/[boardId]/analytics` fetches the analytics endpoint with TanStack Query
- Four KPI cards with metric definitions, sample sizes, and empty-data handling:
  - Avg cycle time
  - p85 cycle time
  - Avg lead time
  - Current WIP
- Custom responsive SVG charts:
  - Weekly throughput bar chart with current-week emphasis, value labels, and 8-week average line
  - Horizontal WIP-by-column chart with first/active/Done roles and amber bottleneck highlighting
- Loading skeleton, error/retry state, snapshot timestamp, and back-to-Kanban navigation
- Accessible chart summaries, legends, keyboard-friendly controls, and reduced-motion support

---

## Verified

- `@fake-trello/shared` build ✅
- `tsc --noEmit` for API ✅ and Web ✅
- `nest build` ✅
- `next build` ✅ — includes `/board/[boardId]`, `/board/[boardId]/(.)cards/[cardId]`, `/board/[boardId]/cards/[cardId]`, and `/board/[boardId]/analytics`
- API boots against the Docker Compose database (`✅ Database connected`), DI graph and all routes map correctly
- Route mapping confirmed in Nest logs:
  - `PATCH /api/cards/:id`
  - `GET /api/boards/:boardId/analytics`
- Analytics SQL was executed against an in-memory PostgreSQL (PGlite) with a seeded board:
  - lead avg 64h / p85 81.6h from 3 samples
  - cycle avg 24h / p85 40.8h from 2 samples
  - WIP and weekly throughput matched expected values
  - same-column reorder events were correctly ignored
  - empty board returned zero metrics and eight zeroed weeks
- `next start` smoke test: board and analytics routes return HTTP 200

---

## Remaining Work

1. **Browser verification (highest priority)** — the stack now boots end-to-end:
   ```bash
   docker compose up -d
   set -a; source apps/api/.env; set +a
   npx prisma db push && npx pnpm db:seed
   npx pnpm dev
   ```
   HTTP/API smoke checks pass (login, workspace/board detail, analytics, `/board/:id` and `/board/:id/analytics` render). Still needs a manual browser pass for card CRUD, card modal auto-save, drag & drop, and realtime between two browsers.

2. **Realtime completeness** — `useBoardSocket` currently handles `card:created`, `card:updated`, `card:moved`, and `column:reordered`. It does not handle `card:deleted` or `card:commented`, so those changes from other users need a refetch.

3. **Label management UI** — labels can be toggled on a card, but there is no board-level create/edit/delete UI. The backend CRUD and `useCreateLabel` hook exist; update/delete hooks and UI do not.

4. **Assignee UI** — the API supports `assigneeId` and returns board members, but the card detail modal has no assignee picker yet.

5. **Activity feed UI** — the backend exposes board activity, but the frontend does not render it.

6. **Tests** — there are no unit, integration, or E2E tests. Priority areas: fractional ordering, card moves, analytics SQL, socket queue/flush, and auto-save race handling.

7. **Repository/operations** — the repository still has no commits; create an initial commit once secrets and generated files are excluded. Keep deployment env configuration in sync.

8. **Low priority** — dark mode, notifications, CSV/JSON export, date-range filters for analytics, and a live analytics refresh.

---

## Setup Instructions

### Prerequisites
- Node.js >= 18
- pnpm >= 8 (`npx pnpm@8` works if pnpm is not installed globally)
- Docker Desktop — PostgreSQL runs in the container defined by `docker-compose.yml`; no host PostgreSQL install is needed

### Database (Docker Compose)
`docker-compose.yml` runs PostgreSQL 16 and takes its credentials from the root `.env` (`POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_PORT`), so they stay in sync with `DATABASE_URL` in `apps/api/.env`.

```bash
docker compose up -d        # start (waits until the pg_isready healthcheck passes)
docker compose ps           # expect "Up (healthy)"
docker compose logs -f      # follow logs
docker compose down         # stop, keeps the fake-trello-pgdata volume
docker compose down -v      # stop and delete all data (re-run db push + seed afterwards)
```

The container is named `fake-trello-pg` and intentionally reuses the `fake-trello-pgdata` volume, so data created before compose existed is not lost. On the first `up` Docker warns that the volume "was not created by Docker Compose" — that is expected and harmless.

### Installation
Prisma CLI and `prisma/seed.ts` read `DATABASE_URL` from the environment; the root `db:*` scripts do not load `apps/api/.env` themselves, so export it first:

```bash
npx pnpm install
set -a; source apps/api/.env; set +a   # exports DATABASE_URL, PORT, JWT_*, ...
npx prisma generate
npx prisma db push                     # run from the repo root (prisma/schema.prisma)
npx pnpm db:seed
```

### Running
```bash
npx pnpm dev                  # turbo run dev → API :4000 and web :3000 together
```

Or in separate terminals:

```bash
# Terminal 1 - API (port 4000, prefix /api)
npx pnpm --filter fake-trello-api run start:dev

# Terminal 2 - Frontend (port 3000)
npx pnpm --filter fake-trello-web run dev
```

### Environment Variables

Root `.env` — consumed by `docker compose` for the database container:
```env
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=trello_clone
POSTGRES_PORT=5432
```

`apps/api/.env` — consumed by the NestJS API and Prisma:
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/trello_clone?schema=public"
JWT_ACCESS_TOKEN_SECRET="..."
JWT_REFRESH_TOKEN_SECRET="..."
PORT=4000
NODE_ENV=development
FRONTEND_URL="http://localhost:3000"
```
`JWT_SECRET` is still accepted as a fallback. Keep `POSTGRES_*` in the root `.env` aligned with `DATABASE_URL` above; changing one without the other breaks the connection.

Web env (currently stored at `apps/web/src/.env.local`):
```env
NEXT_PUBLIC_API_URL=http://localhost:4000/api
NEXT_PUBLIC_WS_URL=http://localhost:4000
```

### Demo credentials
- Email: `demo@fake-trello.com`
- Password: `password123`

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `docker-compose.yml` | Local PostgreSQL 16 container (credentials from root `.env`) |
| `prisma/schema.prisma` | Database schema + enums |
| `prisma/seed.ts` | Demo data |
| `packages/shared/src/types.ts` | Shared interfaces + `FractionalIndex` |
| `packages/shared/src/validators.ts` | Zod schemas/DTO types |
| `apps/api/src/common/guards/jwt-auth.guard.ts` | Global auth guard (`@Public()` opts out) |
| `apps/api/src/common/guards/board-member.guard.ts` | Board membership check |
| `apps/api/src/realtime/realtime.gateway.ts` | Socket.io gateway |
| `apps/api/src/cards/cards.service.ts` | Card CRUD/move + broadcasts |
| `apps/api/src/cards/card-detail.controller.ts` | `PATCH /api/cards/:id` |
| `apps/api/src/analytics/analytics.service.ts` | CTE/window-function analytics queries |
| `apps/api/src/analytics/analytics.controller.ts` | Guarded analytics endpoint |
| `apps/api/src/analytics/analytics.module.ts` | Analytics module wiring |
| `apps/web/lib/api.ts` | HTTP client |
| `apps/web/lib/socket.ts` | Socket.io client |
| `apps/web/hooks/useBoardQueries.ts` | Board/analytics queries and mutations |
| `apps/web/hooks/useBoardSocket.ts` | Realtime cache updates and drag queue |
| `apps/web/hooks/useCardAutosave.ts` | Debounced/serialized card auto-save |
| `apps/web/src/app/board/[boardId]/page.tsx` | Board page + DnD wiring |
| `apps/web/src/app/board/[boardId]/layout.tsx` | Board layout with `@modal` slot |
| `apps/web/src/app/board/[boardId]/@modal/(.)cards/[cardId]/page.tsx` | Intercepted card modal route |
| `apps/web/src/app/board/[boardId]/cards/[cardId]/page.tsx` | Full-page card fallback |
| `apps/web/components/card-modal/CardDetailModal.tsx` | Card detail editor |
| `apps/web/components/card-modal/CardDetailRoute.tsx` | Board/card loading + error shell |
| `apps/web/src/app/board/[boardId]/analytics/page.tsx` | Analytics dashboard |
| `apps/web/components/analytics/BoardCharts.tsx` | Responsive SVG charts |
| `apps/web/components/board/BoardHeader.tsx` | Board header, filters, analytics link |
| `apps/web/middleware.ts` | Route protection |

---

## Known Limitations

- `apps/api/.env` was not modified by the agent (secret file); the code accepts both `JWT_ACCESS_TOKEN_SECRET` and `JWT_SECRET`, so existing values still work.
- The app now runs against real PostgreSQL via Docker Compose, but verification is limited to HTTP/API smoke checks; interactive flows (drag & drop, modal auto-save, realtime across two browsers) have not been exercised in a browser.
- On seeded data the analytics endpoint returns zero lead/cycle-time samples because the seed creates no completion activity; WIP and throughput are populated.
- `apps/web/src/.env.local` is not read by Next.js, which loads env files from `apps/web/`. The values match the fallbacks in `lib/api.ts` and `lib/socket.ts`, so the app works on the default ports; changing ports requires moving the file to `apps/web/.env.local`.
- No automated tests exist.
- The repository has no commits yet.

---

*Last Updated: 2026-11-17*
