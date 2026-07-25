# Assumptions, Scope & Limitations

This system is a scoped exercise, not a production-ready platform. This document states what was
deliberately built, what was deliberately left out, and why — per the assignment's own guidance
to prioritize and document scope rather than attempt full coverage.

## Booking states

A booking has 5 states: `PENDING_PAYMENT` (created, holding inventory), `CONFIRMED` (paid),
`CANCELLED` (customer-cancelled while unpaid), `EXPIRED` (hold timed out, released automatically),
`FAILED` (operator-marked, e.g. after a disputed/failed payment). `PATCH
/admin/bookings/:id/status` supports moving a booking into any of these five states. See
`docs/architecture.md` §3 for the transition diagram.

## What's built

- Customer flow: browse published concerts, view ticket categories/prices/availability, reserve
  tickets (with idempotency-key dedup), apply a voucher code, simulate payment, cancel an unpaid
  booking, track booking status.
- Operator flow: create/update concerts, add ticket categories, publish a concert, create voucher
  campaigns, list/filter bookings (by status, concert, or a "suspicious" = failed/expired filter),
  manually override a booking's status.
- Concurrency safety: atomic conditional inventory decrements (oversell prevention), idempotency
  keys (duplicate-booking prevention), unique per-user voucher redemption (abuse prevention) — all
  enforced at the database transaction level. See `docs/architecture.md` §4 for the full
  reasoning.
- An expiry sweep that releases abandoned (`PENDING_PAYMENT` past hold) bookings automatically.
- Redis cache-aside for concert browsing, Redis-backed rate limiting on write endpoints.

## What's explicitly not built (and why)

- **No payment gateway integration.** `POST /bookings/:id/pay` simulates a successful payment
  synchronously. A real integration (Stripe/VNPay/etc.) would add webhook handling, signature
  verification, and a `WAITING_FOR_PAYMENT_CALLBACK` sub-state — out of scope for validating
  backend design thinking.
- **No voucher update/delete APIs.** Vouchers can only be created (seeded) and listed from the
  dashboard; editing or deleting a live voucher mid-campaign raises consistency questions
  (e.g. what happens to already-redeemed vouchers) that weren't worth solving for this exercise.
  This mirrors the assignment's own example of an acceptable scope cut.
- **`perUserLimit` on Voucher is stored but only the DB-enforceable case of 1 is actually
  enforced** (via a `(voucherId, userId)` unique constraint). Enforcing an arbitrary N would need
  a per-user counter with its own race conditions to solve, which felt like scope creep beyond
  what "prevent voucher abuse" required for the exercise.
- **No refunds / no cancelling a `CONFIRMED` booking.** Customers can only cancel while
  `PENDING_PAYMENT`. Cancelling a paid booking implies a refund flow tied to the (non-existent)
  payment gateway.
- **No operator invite/admin-created-operator flow.** Public `POST /auth/register` always creates
  a `CUSTOMER`; the one `OPERATOR` account is seeded (`prisma/seed.ts`). A real system would have
  an operator-only user-management surface.
- **Minimal auth.** JWT with a single long-lived access token (default 1 day, no refresh token
  rotation), no email verification, no password reset, no rate limiting on login attempts beyond
  the global throttler.
- **No soft delete / audit log.** Admin actions (status overrides, concert edits) don't leave an
  audit trail. For a real operation dashboard this would likely be one of the first things added.
- **Redis is a performance layer, not a correctness mechanism**, by design — see
  `docs/architecture.md` §4.5. A Redis-based distributed lock or virtual waiting room was
  considered and deliberately not built, because Postgres row-level locking is already correct
  and sufficient at the stated flash-sale traffic (300-500 booking writes/min); adding a second
  source of truth would be complexity without a correctness or (at this scale) performance
  benefit. This is the first thing to revisit if real traffic significantly exceeds the stated
  numbers.
- **No horizontal-scaling concerns addressed** (e.g. the `@Cron` expiry sweep assumes a single
  app instance; running multiple instances would double-run the sweep — harmless here since the
  underlying UPDATE is idempotent/conditional, but worth flagging).
- **Testing scope is intentionally narrow**: unit tests cover the concurrency-critical paths in
  `BookingsService` (oversell rejection, idempotent retry, voucher per-user-limit, expiry
  restoring inventory). No e2e tests, no load tests. Manually verifying with a burst of concurrent
  requests against constrained seed inventory is documented in the README instead of being
  automated, given the time budget.
- **No production concerns**: no structured logging/observability, no health-check readiness
  probes beyond a basic `/health`, no CI pipeline, no containerized app image (only Postgres/Redis
  are dockerized; the app runs via `npm run start:dev` for local development).

## Notable design decisions worth flagging

- **Money is stored as `Decimal(10,2)`** (VND has no minor unit in practice here, but decimal
  avoids floating-point rounding issues generically).
- **IDs are `cuid()`** rather than auto-increment integers, to avoid leaking sequential booking
  counts (a minor consideration for a ticketing platform where competitors/users might infer
  sales volume).
- **The "validate ticket availability" dashboard requirement** is served by the existing concert
  detail response (`GET /admin/concerts/:id` returns each ticket category's `availableQuantity`)
  rather than a separate endpoint — there was no additional information a dedicated endpoint would
  expose.
