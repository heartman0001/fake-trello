# Fake Trello - Production-grade Real-time Kanban Board

A modern, real-time Kanban board application built with Next.js (App Router), NestJS, PostgreSQL, and Prisma ORM.

## Architecture

- **Frontend**: Next.js 14 (App Router) + Tailwind CSS + TanStack Query + Zustand + @dnd-kit
- **Backend**: NestJS REST API + Socket.io for real-time updates
- **Database**: PostgreSQL with Prisma ORM
- **Shared**: Monorepo structure with TypeScript shared packages

## Tech Stack

### Frontend
- Next.js 14 App Router
- Tailwind CSS for styling
- TanStack Query for server state
- Zustand for client state
- @dnd-kit for drag-and-drop
- React Hook Form for forms
- Zod for validation

### Backend
- NestJS with modular architecture
- Socket.io for real-time WebSocket communication
- Prisma ORM with PostgreSQL
- JWT authentication
- Role-based access control
- Fractional indexing for smooth reordering

## Getting Started

### Prerequisites

- Node.js >= 18.0.0
- pnpm >= 8.0.0
- PostgreSQL >= 14

### Installation

1. Install dependencies:
```bash
pnpm install
```

2. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your database URL and JWT secrets
```

3. Set up the database:
```bash
pnpm db:generate
pnpm db:push
pnpm db:seed
```

4. Run the development servers:
```bash
# Terminal 1 - API server
pnpm --filter fake-trello-api run start:dev

# Terminal 2 - Frontend
pnpm --filter fake-trello-web run dev
```

### Docker (single command)

Builds the API and web images and starts Postgres, API, and web together:
```bash
pnpm docker:up        # = docker compose up --build -d
```

Then open http://localhost:3000 (API on http://localhost:4000/api). The API
container runs `prisma db push` on startup, so no manual DB setup is needed.
To only build the images: `pnpm docker:build` (`docker compose build`).

### API Documentation

The API is available at `http://localhost:3001/api`

Available endpoints:
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/refresh` - Refresh access token
- `GET /api/workspaces` - List user workspaces
- `GET /api/boards` - List user boards
- `GET /api/boards/:id` - Get board details
- `POST /api/boards` - Create board
- `PUT /api/boards/:id` - Update board
- `DELETE /api/boards/:id` - Delete board
- `GET /api/boards/:boardId/columns` - List columns
- `POST /api/boards/:boardId/columns` - Create column
- `GET /api/boards/:boardId/columns/:columnId/cards` - List cards
- `POST /api/boards/:boardId/columns/:columnId/cards` - Create card
- `POST /api/boards/:boardId/columns/:columnId/cards/:id/move` - Move card

### WebSocket Events

The API server broadcasts the following events to board rooms:
- `card:created` - New card created
- `card:updated` - Card updated
- `card:deleted` - Card deleted
- `card:moved` - Card moved to different column
- `card:commented` - Comment added to card
- `column:reordered` - Columns reordered
- `board:updated` - Board updated
- `activity:logged` - Activity logged

## Features

- ✅ User authentication with JWT
- ✅ Workspace management with role-based access
- ✅ Board and column management
- ✅ Card creation, editing, and deletion
- ✅ Card drag-and-drop with fractional indexing
- ✅ Card labels
- ✅ Checklists with items
- ✅ Comments on cards
- ✅ Real-time updates via WebSocket
- ✅ Activity logging
- ✅ Responsive UI with Tailwind CSS

## Development

### Building

```bash
pnpm build
```

### Running Tests

```bash
pnpm test
```

### E2E Tests (Playwright)

The E2E suite drives a real browser against a running stack, so start it first:

```bash
corepack pnpm docker:up        # or: docker compose up --build -d
corepack pnpm test:e2e
```

Useful options:

```bash
corepack pnpm test:e2e --headed          # watch the browser
corepack pnpm test:e2e --debug           # step through with the inspector
corepack pnpm --filter fake-trello-web exec playwright show-report
```

- Tests live in `apps/web/e2e/` and target `http://localhost:3000` (`E2E_BASE_URL` to override) and `http://localhost:4000/api` (`E2E_API_URL`).
- Expectations are read from the API at runtime, so they keep working after the demo board is edited.
- First run needs the browser: `corepack pnpm --filter fake-trello-web exec playwright install chromium`.

### Database Management

```bash
pnpm db:push      # Push schema to database
pnpm db:seed      # Seed database with demo data
pnpm db:studio    # Open Prisma Studio
```

## License

ISC
