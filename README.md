# Concert Ticket Booking Platform — Backend

Take-home assignment submission: a backend for a Concert Ticket Booking Platform covering
customer-facing booking flows and an internal Operation Dashboard.

- **Stack**: NestJS + TypeScript, PostgreSQL (via Prisma), Redis
- **System design & DB design**: [`docs/architecture.md`](docs/architecture.md)
- **Assumptions & scope limitations**: [`docs/ASSUMPTIONS.md`](docs/ASSUMPTIONS.md)
- **Coding guideline / how to add an API / how to run tests**: [`docs/CONTRIBUTING.md`](docs/CONTRIBUTING.md)
- **API docs**: Swagger UI at `/api/docs` once running
- **Postman collection**: [`docs/postman_collection.json`](docs/postman_collection.json) + [`docs/postman_environment.json`](docs/postman_environment.json)

## Prerequisites

- Node.js 20+
- Docker Desktop (for local Postgres + Redis)

## Setup & run locally

```bash
# 1. Install dependencies
npm install

# 2. Copy env file (defaults already match docker-compose.yml)
cp .env.example .env

# 3. Start Postgres + Redis
docker compose up -d

# 4. Apply database schema
npx prisma migrate dev

# 5. Seed sample data (1 operator, 2 customers, 3 concerts, 2 vouchers)
npm run seed

# 6. Start the API in watch mode
npm run start:dev
```

The app listens on `http://localhost:3000`. Swagger UI: `http://localhost:3000/api/docs`.

### Troubleshooting: Docker Desktop / WSL2 not starting

If `docker compose up -d` hangs or `docker` commands fail with a WSL-related error (Windows), the
WSL2 backend itself is stuck rather than Docker:

```powershell
wsl --shutdown   # then reopen Docker Desktop
```

If that doesn't resolve it, reboot Windows. As a last resort (no admin rights / WSL still broken),
Postgres and Redis can run natively instead of via Docker — the app only cares about
`DATABASE_URL`/`REDIS_URL` in `.env`, not how those services are hosted:

- Postgres: install with `winget install PostgreSQL.PostgreSQL.17`, or run any portable Postgres
  binaries (e.g. `initdb` + `pg_ctl start` against a local data directory) and point
  `DATABASE_URL` at it.
- Redis: install [Memurai](https://www.memurai.com/) (Redis-compatible, has a free dev edition),
  or run a portable `redis-server.exe` build, and point `REDIS_URL` at it.

### Seeded accounts (password for all: `Password123!`)

| Role | Email |
|---|---|
| Operator | `operator@ticketing.local` |
| Customer | `customer1@ticketing.local` |
| Customer | `customer2@ticketing.local` |

### Trying it out

1. Import `docs/postman_collection.json` and `docs/postman_environment.json` into Postman.
2. Select the "Ticketing - Local" environment.
3. Run the collection's folders top-to-bottom: **Auth → Admin - Concerts → Admin - Vouchers →
   Concerts (Public) → Bookings (Public) → Admin - Bookings**. Requests chain automatically via
   collection variables (tokens, concert/ticket-category/booking IDs).

Alternatively, browse and call everything directly from Swagger UI at `/api/docs` — click
**Authorize** and paste an `accessToken` from a `POST /auth/login` response.

## Running tests

```bash
npm run test        # unit tests (focused on BookingsService concurrency logic)
npm run test:watch
npm run test:cov
```

## Project structure

```
src/
  common/            # guards, decorators, exception filters shared across modules
  prisma/            # PrismaService (DB access)
  redis/             # Redis client + cache-aside helper
  auth/              # register/login, JWT strategy, roles
  concerts/          # public browsing + admin concert/ticket-category management
  vouchers/          # admin voucher creation/listing + redemption logic
  bookings/          # core booking flow (reserve/pay/cancel), admin booking management, expiry sweep
prisma/
  schema.prisma      # DB design (see docs/architecture.md for rationale)
  seed.ts
docs/
  architecture.md
  ASSUMPTIONS.md
  CONTRIBUTING.md
  postman_collection.json
  postman_environment.json
docker-compose.yml   # local Postgres + Redis only; the app itself runs via `npm run start:dev`
```
