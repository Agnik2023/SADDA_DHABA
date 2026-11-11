# SADDA DHABA — Build State

Last updated: 2026-11-12

## Current phase

Phase 9 — Deployment readiness. Application code and SQL are complete, the
production build passes, and the full order lifecycle has been exercised against
Postgres 18 with Supabase platform shims (44 checks). Live setup is blocked on
Supabase credentials.

## Locked decisions

- Hosting: Cloudflare Pages (free, commercial use allowed).
- Backend: Supabase Free (Postgres, Auth, Realtime).
- Customers: guests only, no accounts, no OTP.
- Order access: high-entropy token in URL fragment (`/order#<token>`); server stores SHA-256 hash only.
- Staff roles: `dev`, `counter`, `kitchen`.
- `dev`: full access, TOTP MFA required for privileged actions.
- `counter`: payments, walk-in orders, cancel unpaid, availability toggle, history.
- `kitchen`: paid orders only, preparation status.
- Payment: no online gateway. Counter verifies cash/UPI/card physically.
- Kitchen gate: only `mark_paid` can move an order to `QUEUED`.
- Money: integer paise in the database.
- Dine-in: `DINE_IN` / `TAKEAWAY` plus optional table number. No per-table QR in v1.
- No customer manager, no paid-order editor, no localStorage business data.
- Tax default: 5% (`tax_rate_bps = 500`); confirm inclusive/exclusive with accountant.
- Customer cart: `sessionStorage`. Last order token: `localStorage` only for "Track order".
- Staff session: `sessionStorage`; counter/dev idle lock 15 minutes, kitchen 8 hours.

## Status flow

`AWAITING_PAYMENT -> QUEUED -> PREPARING -> READY | SERVED -> COMPLETED`

`AWAITING_PAYMENT -> CANCELLED` by counter/dev.

Paid orders -> `CANCELLED` + `REFUNDED` by dev only (AAL2).

## Build checklist

- [x] 1A. Core schema migration (`0001_schema.sql`)
- [x] 1B. RLS policies and grants (`0002_rls.sql`)
- [x] 1C. RPC functions (`0003_rpc.sql`)
- [x] 1D. Menu seed — 13 categories, 93 items (`0004_seed_menu.sql`)
- [x] 1E. Realtime + pg_cron migration (`0005_realtime_cron.sql`)
- [ ] 2. Supabase project created and migrations applied
- [ ] 3. Staff Auth users, role rows, dev TOTP enrollment
- [x] 4. Frontend foundation (types, client, query, cart, auth)
- [x] 5. Customer menu -> cart -> checkout -> token status
- [x] 6. Counter queue -> mark paid -> kitchen board
- [x] 7. Menu manager, history, settings, refunds
- [x] 8. Removed old auth/payment/localStorage code; rewrote README
- [x] 9. Cloudflare Pages config (`_headers`, `_redirects`, `.nvmrc`, env example)
- [x] 10. Backup and keep-alive GitHub workflows
- [x] 10a. Migration lifecycle validated against Postgres 18 (PGlite, 44 checks)
- [ ] 11. Apply migrations, RLS/order-flow smoke tests in a live project
- [ ] 12. Deploy to Cloudflare Pages and set environment variables
- [ ] 13. Pilot shift and go-live

## Completed files

### Backend

- `supabase/migrations/0001_schema.sql` — staff, settings, categories, menu, orders, order items, tokens, events, indexes, updated_at triggers. Installs `pgcrypto` in `extensions` and `pg_cron` in `pg_catalog` to match Supabase.
- `supabase/migrations/0002_rls.sql` — role helpers, paid-only kitchen visibility, dev AAL2 writes, explicit grants.
- `supabase/migrations/0003_rpc.sql` — quote/create/get-by-token, mark-paid, status, cancel/refund, counter order, availability, token reissue, stale cancellation. All functions pin `search_path = public, extensions, pg_temp`; hardened JSON parsing and merged-quantity validation.
- `supabase/migrations/0004_seed_menu.sql` — deterministic UUIDs, idempotent upserts, availability preserved.
- `supabase/migrations/0005_realtime_cron.sql` — Realtime publication for orders/items/menu/categories, 5-minute stale-order job.
- `supabase/seed/legacy_initialData.ts.bak` — original pre-Supabase sample data, kept for provenance only. Not compiled or imported.

### Frontend

- `src/types/index.ts` — roles, statuses, paise, order/token types.
- `src/lib/supabase.ts` — browser client with sessionStorage staff auth.
- `src/lib/api.ts` — typed data/RPC layer.
- `src/lib/money.ts`, `errors.ts`, `ids.ts`, `orderStatus.ts`, `datetime.ts`, `customerToken.ts`.
- `src/context/CartContext.tsx`, `ToastContext.tsx`, `StaffAuthContext.tsx`.
- `src/hooks/useMenu.ts` — React Query queries, polling, realtime invalidation.
- Customer: `CustomerApp`, `CategoryBar`, `MenuItemCard`, `CartDrawer`, `CheckoutModal`, `OrderStatusView`, `OrderStatusPage`.
- Admin: `AdminLogin`, `MfaChallenge`, `LockScreen`, `AdminNavbar`, `AdminDashboard`, `CounterQueue`, `KitchenBoard`, `CollectPaymentModal`, `OrderDetailsModal`, `AddOrderModal`, `MenuManager`, `OrderHistory`, `Settings`.
- Common: `Badge`, `Modal`, `ConfirmDialog`, `ConfigNotice`.
- `src/App.tsx` — QueryClient, Toast, Cart, StaffAuth providers; routes `/`, `/order`, `/admin/*`.

### Delivery

- `README.md` — setup, staff SQL, Cloudflare Pages, operations, security, backups, smoke test.
- `public/_headers` — CSP and security headers, asset caching.
- `public/_redirects` — SPA fallback.
- `.env.example`, `.nvmrc`, updated `.gitignore`.
- `.github/workflows/backup.yml` — nightly encrypted `pg_dump` artifact.
- `.github/workflows/keep-alive.yml` — daily Supabase REST ping.

## Validation run

`C:\Users\Sumit Chatterjee\AppData\Local\Temp\opencode\sadda-pglite\migration-test.mjs`
runs migrations `0001`–`0005` against PGlite (PostgreSQL 18) with shims for
`auth.users`, `auth.uid()`, `auth.jwt()`, the `anon`/`authenticated` roles, and
`digest`/`gen_random_bytes`. Result: **44 passed, 0 failed**, covering
seed counts, quoting, idempotency, token lookup/reissue, RLS visibility, the
kitchen payment gate, payment audit, status transitions, refunds with/without
AAL2, walk-ins, availability, cancellation, stale auto-cancel, and rate limits.
The 0005 publication/cron statements also apply in PGlite. Live Supabase
RLS/Realtime/cron behavior still needs the project smoke test.

## Blocked

- No Supabase project URL / anon key, so migrations are not applied and live RLS, Realtime, cron, and order-flow tests cannot run.
- Actual deployment and staff-account creation require Supabase credentials and a Cloudflare Pages project.

## Next move

0. Repository is committed and pushed: `origin/main` at `a1de71d`.
1. Create the Supabase project; run migrations `0001` -> `0005` in the SQL Editor (enable `pg_cron`/Realtime if prompted).
2. Send the project URL and anon/publishable key so the frontend can be configured; never send the `service_role` key or database password in chat.
3. Create `dev`, `counter`, `kitchen` Auth users, insert `public.staff` rows, disable new-user signups.
4. Run the README smoke test: guest order -> unpaid hidden from kitchen -> counter mark paid -> kitchen prep -> handover -> history CSV.
5. Enroll dev TOTP and verify AAL2 gates (refund/menu/settings).
6. Deploy to Cloudflare Pages; set env vars for production.
7. Add `SUPABASE_DB_URL`, `BACKUP_PASSPHRASE`, `SUPABASE_URL`, `SUPABASE_ANON_KEY` GitHub secrets and manually run both workflows once.
8. Test a restore from the encrypted artifact before the pilot.

## Operational reminders

- Supabase Free pauses after 7 days of low activity and has no automatic backups.
- GitHub may disable scheduled workflows after 60 days of repository inactivity; re-enable or run `workflow_dispatch` monthly.
- The dev TOTP setup key must be stored offline. Losing it requires an owner/admin reset in Supabase.
- Never place the `service_role` key in the frontend or Cloudflare environment.
- Menu changes and refunds are audited in `order_events`; check the audit trail if totals or statuses look wrong.
