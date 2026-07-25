# Coding Guideline & Convention

## Module structure

Each domain lives in its own module under `src/<domain>/`, following Nest's standard shape:

```
src/<domain>/
  dto/                      # request DTOs, validated with class-validator, documented with @nestjs/swagger
  <domain>.service.ts       # business logic + Prisma access; the only place querying the DB for this domain
  <domain>.controller.ts    # public/customer-facing routes (if any)
  admin-<domain>.controller.ts  # /admin/* routes for this domain (if any), guarded with @Roles(Role.OPERATOR)
  <domain>.module.ts
```

Cross-cutting pieces live in `src/common/` (guards, decorators, filters), `src/prisma/`
(database access), and `src/redis/` (cache + raw client).

## How to add a new API endpoint

1. **DTO** — add a class in `<domain>/dto/`, decorate fields with `class-validator` decorators
   for runtime validation and `@ApiProperty`/`@ApiPropertyOptional` (from `@nestjs/swagger`) so it
   shows up correctly in Swagger. Reuse `PartialType(CreateXDto)` for update DTOs (see
   `concerts/dto/update-concert.dto.ts`).
2. **Service method** — add the method to the relevant `*.service.ts`. All Prisma access for a
   domain goes through its own service; don't reach into `PrismaService` from a controller.
   - If the operation touches inventory (tickets or vouchers) or must be atomic with another
     write, wrap it in `this.prisma.$transaction(...)` and use the conditional-UPDATE pattern
     described in `docs/architecture.md` §4.1 rather than a read-then-write.
3. **Controller method** — thin: validate nothing beyond what the DTO/pipes already do, call the
   service, return its result directly (Nest serializes it). Add `@ApiOperation({ summary })` for
   Swagger. Public routes need `@Public()` (see `common/decorators/public.decorator.ts`); admin
   routes live under an `admin/*` controller class decorated with `@Roles(Role.OPERATOR)`.
4. **Wire it up** — register new providers/controllers in the domain's `*.module.ts`. New domain
   modules get imported into `AppModule`.
5. If the endpoint changes the DB schema, add/adjust the relevant model in
   `prisma/schema.prisma` and run `npx prisma migrate dev --name <change>`.

## Conventions

- **Errors**: throw Nest's built-in HTTP exceptions (`NotFoundException`, `ConflictException`,
  `BadRequestException`, etc.) from services; don't construct raw `{status, message}` objects.
  Prisma errors that aren't explicitly caught fall through to `PrismaExceptionFilter`
  (`common/filters/prisma-exception.filter.ts`), which maps `P2002`/`P2025` to sensible HTTP
  codes as a safety net — but prefer catching and handling known cases explicitly in the service
  (see `BookingsService.create`'s idempotency-key conflict handling) when the generic mapping
  isn't precise enough.
- **Auth**: `JwtAuthGuard` and `RolesGuard` are registered globally in `AppModule`. Routes are
  authenticated by default — opt out with `@Public()`, opt into a role with `@Roles(Role.X)`.
  Read the current user with the `@CurrentUser()` param decorator, never by re-decoding the JWT
  in a controller.
- **Money**: always `Prisma.Decimal`/`Decimal(10,2)` in the DB and in TypeScript — never plain
  `number` for amounts once they leave a DTO (DTOs accept `number` from JSON, services convert).
- **Formatting/linting**: this project uses the default NestJS ESLint + Prettier setup. Run
  `npm run lint` before committing; `npm run format` to auto-format.

## How to run unit tests

```bash
npm run test          # run once
npm run test:watch    # watch mode while developing
npm run test:cov      # with coverage report
```

Tests live next to the file they cover, as `*.spec.ts` (Jest convention, matches
`src/**/*.spec.ts`). The existing suite (`src/bookings/bookings.service.spec.ts`) is the reference
example: it mocks `PrismaService` and `VouchersService` rather than hitting a real database, to
keep unit tests fast and focused on the service's own logic (see `docs/ASSUMPTIONS.md` for why
broader integration/e2e coverage was intentionally left out of scope).

## How to run the app locally

See the root [`README.md`](../README.md) for the full setup (Docker Compose for Postgres/Redis,
Prisma migrate, seed script, `npm run start:dev`).
