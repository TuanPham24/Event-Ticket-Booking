-- Supabase auto-exposes every table in the `public` schema through its
-- PostgREST API unless RLS is enabled, regardless of whether the app uses
-- that API. This app only ever talks to Postgres via Prisma over a direct
-- connection (never Supabase's REST/anon-key API), and the Prisma
-- connection role owns these tables -- table owners bypass RLS by default,
-- so enabling RLS with no policies blocks Supabase's anon/authenticated
-- PostgREST roles without affecting the app itself.
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "concerts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ticket_categories" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "vouchers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "bookings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "booking_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "voucher_redemptions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "_prisma_migrations" ENABLE ROW LEVEL SECURITY;
