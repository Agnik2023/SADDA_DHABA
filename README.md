# SADDA DHABA — Guest Ordering & Staff Console

A production-oriented ordering system for a single restaurant:

- Guests browse the menu, place an order, and **pay at the counter**. No customer accounts, no OTP, no online payment.
- Only **paid orders reach the kitchen**. Counter staff physically verify cash/UPI/card and confirm the payment.
- Staff sign in with Supabase Auth. `dev` accounts also require a TOTP authenticator code.
- Runs at **zero recurring cost** on Cloudflare Pages (frontend) and Supabase Free (Postgres, Auth, Realtime).

---

## How an order works

```
Guest places order
      │
      ▼
AWAITING_PAYMENT ── counter verifies money ──► QUEUED ──► PREPARING ──► READY (takeaway)
      │                                                              └► SERVED (dine-in)
      │                                                                     │
      └── counter cancels unpaid                                            ▼
              CANCELLED ◄── dev refunds a paid order ─────────────── COMPLETED
```

- The guest receives an order code (`SD-XXXXX`) and a private tracking link: `/order#<token>`.
- The token is generated in the browser (32 random bytes). The server stores only its SHA-256 hash.
- The kitchen role cannot read unpaid rows, enforced by Postgres RLS—not just by hiding buttons.
- Prices and totals are calculated inside the database from live menu prices. Client prices are ignored.

## Roles

| Role | Can do |
| --- | --- |
| `dev` | Everything: counter, kitchen, menu CRUD, categories, settings, refunds. Requires TOTP for privileged actions. |
| `counter` | Collect/confirm payments, create walk-in orders, cancel unpaid orders, toggle item availability, view history, reissue tracking links. |
| `kitchen` | See paid orders only, move `QUEUED → PREPARING → READY/SERVED`. |

`dev` actions that change money or configuration (refunds, menu writes, settings) require **AAL2**—a session that passed TOTP—and are checked again inside the database.

---

## Local development

Requirements: Node.js 20.19+ (Node 22 recommended), npm.

```bash
npm install
cp .env.example .env.local     # Windows: copy .env.example .env.local
npm run dev
```

Open:

- Customer site: `http://localhost:5173/`
- Staff console: `http://localhost:5173/admin`
- Order tracking: `http://localhost:5173/order#<token>`

The app shows a setup screen until `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are present.

```bash
npm run build     # TypeScript check + production build into dist/
npm run preview   # serve the production build locally
```

---

## Supabase setup (one time)

### 1. Create the project

1. Create a free project at [supabase.com](https://supabase.com).
2. Open **Project Settings → API** and copy:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon / publishable key** → `VITE_SUPABASE_ANON_KEY`

Put them in `.env.local`. The anon key is safe in a browser because RLS protects the data. Never put the `service_role` key in this frontend.

### 2. Apply the migrations

In **SQL Editor**, run these files in order, one at a time:

1. `supabase/migrations/0001_schema.sql` — tables, constraints, indexes
2. `supabase/migrations/0002_rls.sql` — roles, RLS policies, grants
3. `supabase/migrations/0003_rpc.sql` — quote/create/pay/status/refund/cancel functions
4. `supabase/migrations/0004_seed_menu.sql` — 13 categories, 93 menu items (paise prices)
5. `supabase/migrations/0005_realtime_cron.sql` — Realtime tables + stale-order cron

Notes:

- The migrations are written to be re-runnable.
- `0001` installs `pgcrypto` in the `extensions` schema and `pg_cron` in `pg_catalog`, matching Supabase's layout. All functions include both `public` and `extensions` in their fixed `search_path`, so hashing and random-token generation work regardless of where the extension is installed.
- If `0001` fails on `create extension pg_cron`, enable **pg_cron** under **Integrations → Cron** (or run `create extension pg_cron with schema pg_catalog;`), then run it again.
- If `0005` reports that the `supabase_realtime` publication is missing, enable Realtime in **Database → Replication** and re-run `0005`.
- The menu seed keeps existing availability toggles on conflict, so re-running it will not mark sold-out items available again.

### 3. Create staff accounts

In **Authentication → Users → Add user**, create one email/password account per staff member and enable **Auto Confirm User**. Copy each user's UUID, then run in SQL Editor:

```sql
insert into public.staff (id, display_name, role)
values
  ('<DEV_USER_UUID>',     'Owner',      'dev'),
  ('<COUNTER_USER_UUID>', 'Counter 1',  'counter'),
  ('<KITCHEN_USER_UUID>', 'Kitchen 1',  'kitchen')
on conflict (id) do update
set display_name = excluded.display_name,
    role = excluded.role,
    active = true;
```

A staff account without a row in `public.staff` cannot open the console, even if its password is correct.

### 4. Lock down signups

In **Authentication → Providers → Email**:

- Keep Email/Password enabled.
- Turn **off** “Allow new users to sign up”. Staff users are created by the owner from the dashboard.
- Leave email confirmation on for new users (auto-confirm the accounts you create).

### 5. Enroll the dev authenticator

Sign in at `/admin` with the dev account. The console shows a QR code and setup key:

1. Scan it with Google Authenticator, Authy, 1Password, etc.
2. Enter the 6-digit code.
3. Store the setup key somewhere safe (password manager / sealed envelope).

Counter and kitchen accounts use a password only. A lost dev authenticator requires an owner/admin reset in Supabase; keep at least two dev accounts or a recovery plan.

### 6. Verify RLS

Sign in as the kitchen account and try to query unpaid orders. This must return **zero rows**:

```sql
-- Run in SQL Editor as the kitchen user via the app/SDK, not as postgres,
-- or use the app's kitchen screen: unpaid orders must never appear.
select order_code, status, payment_status from public.orders;
```

Also confirm the kitchen cannot read `order_tokens` and that only `mark_paid` can move an order out of `AWAITING_PAYMENT`.

---

## Deploy to Cloudflare Pages (free)

1. Push this repository to GitHub.
2. Cloudflare Dashboard → **Workers & Pages → Create → Pages → Connect to Git**.
3. Select the repository and use:
   - **Framework preset**: Vite
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
   - **Node version**: 22 (the included `.nvmrc` selects Node 22; Cloudflare's default is already Node 22).
4. Add environment variables for **Production** (and Preview if needed):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
5. Deploy. `public/_redirects` makes `/order` and `/admin/*` work on refresh; `public/_headers` adds CSP and security headers.
6. Optional: add a custom domain under **Custom domains**. `pages.dev` is free.

Every push to the production branch rebuilds the site. Environment variables are baked in at build time—change them and redeploy.

### Preview deployments

Preview builds point at the same Supabase project unless you create a second project. For a real restaurant, keep previews private or use a separate Supabase project so test orders never reach the live kitchen.

---

## Daily operation

### Counter

1. Open `/admin/counter`.
2. Match the guest's order code or name.
3. Take cash / verify UPI / run the card machine.
4. Press **Collect payment**, choose the method, tick the physical-verification confirmation, and submit.
5. The order immediately appears on the kitchen screen. Unpaid orders never do.
6. Mark **Completed** after handover. Cancel unpaid orders with a reason; use **Reissue customer link** if the guest lost their tracking link.

### Kitchen

1. Open `/admin/kitchen` on a tablet or TV. Use the fullscreen button.
2. New paid tickets appear in **New tickets** with a chime.
3. Start preparing → mark **Ready** (takeaway) or **Served** (dine-in).
4. Counter marks the final handover as completed.

### Dev

- `/admin/menu` — add/edit/delete items and categories, change prices, toggle availability.
- `/admin/settings` — GST rate, unpaid timeout, restaurant name.
- `/admin/history` — filter by date/status, search, view audit trail, export CSV.
- Refunds: open a paid order → **Refund (dev)**. This requires AAL2 and records the refund reason in the audit trail.

### Auto-cancellation

`pg_cron` runs `cancel_stale_unpaid_orders()` every 5 minutes. Unpaid orders older than `unpaid_timeout_minutes` (default 30) become `CANCELLED` with a reason visible to the guest. The counter queue therefore cannot fill with abandoned checkouts.

### Customer rate limits

- 3 orders per phone per 10 minutes
- 10 orders per phone per 24 hours
- 2 simultaneous unpaid orders per phone

Adjust these inside `create_order` if the restaurant needs different limits.

---

## Security model

- Guests have no Auth account. Their only access is an unguessable token; the URL fragment is never sent to Cloudflare.
- Only SHA-256 hashes of tokens are stored. Reissuing a link invalidates the previous one.
- All price/order/payment writes go through `SECURITY DEFINER` RPCs with a fixed `search_path`. There are no client insert/update policies on orders.
- Payment confirmation (`mark_paid`) is the single gate into the kitchen. It stores the staff user ID, role, method, amount, and timestamp.
- Refunds and paid-order cancellation require `dev` + AAL2.
- Staff sessions live in `sessionStorage` and are cleared when the tab closes. The counter/dev console locks after 15 idle minutes; kitchen locks after 8 hours.
- CSP in `_headers` restricts scripts to the site itself and connections to `*.supabase.co`.

---

## Backups (important on the free tier)

Supabase Free has **no automatic backups** and pauses projects after 7 days of low activity.

### Nightly encrypted dump

`.github/workflows/backup.yml` runs daily and uploads an encrypted `pg_dump` artifact. Add these repository secrets:

| Secret | Value |
| --- | --- |
| `SUPABASE_DB_URL` | Postgres connection string. Prefer the **Session pooler** URI from **Project Settings → Database** (IPv4-friendly). Include the password. |
| `BACKUP_PASSPHRASE` | A long random passphrase. Store it in a password manager, **not** only in GitHub. |

Download an artifact from the Actions run, then decrypt:

```bash
gpg --decrypt sadda-dhaba-YYYY-MM-DD.sql.gpg > sadda.sql
```

Restore into a fresh Supabase project:

1. Create the project and run migrations `0001`–`0005`.
2. Recreate the staff Auth users and re-insert `public.staff` rows.
3. Restore the public data:

   ```bash
   psql "$SUPABASE_DB_URL" -f sadda.sql
   ```

The dump covers the `public` schema (menu, orders, items, events, settings, staff links). Staff Auth users themselves live in Supabase's `auth` schema; recreate them and re-link rows if restoring into a completely new project. **Test a restore before go-live and then quarterly.**

For day-to-day financial records, also export **History → Export CSV** at the end of each month and archive it.

### Keep-alive

`.github/workflows/keep-alive.yml` makes a small authenticated REST request every day so the free project does not pause. Add these secrets:

| Secret | Value |
| --- | --- |
| `SUPABASE_URL` | `https://<project-ref>.supabase.co` |
| `SUPABASE_ANON_KEY` | The anon/publishable key |

A paused project cannot take orders; the keep-alive is not optional if the restaurant is closed for a week.

---

## Free-tier limits worth knowing

- **Database**: 500 MB (this app uses a few MB even with thousands of orders).
- **Egress**: 5 GB/month. Menu polling and realtime are small; a busy single restaurant fits comfortably.
- **Auth**: 50,000 monthly active users—irrelevant for a handful of staff accounts.
- **No automatic backups, no PITR** on Free. Use the workflow above.
- **Pausing** after 7 days of inactivity. Use the keep-alive workflow.
- **Shared CPU**: enough for one restaurant; keep history queries to the last 30–90 days if the table grows large.

Cloudflare Pages Free allows commercial use (unlike Vercel Hobby). There is no server to maintain.

---

## Smoke test before go-live

1. Load `/` on a phone; confirm all 13 categories and 93 items appear.
2. Add items, checkout with a real name/phone, choose dine-in + table, place the order.
3. Confirm `/order#<token>` shows **Awaiting payment** and the total.
4. Sign in as `counter`; the order appears under **Awaiting payment**. Confirm it is **not** visible on the kitchen screen.
5. Collect payment (use a small real amount if testing live); confirm it moves to **QUEUED** and appears on the kitchen board.
6. Kitchen: start preparing → mark served/ready. Counter: complete handover.
7. Confirm the guest tracking page updates automatically.
8. Dev: change GST, add a test item, mark an item sold out, and verify the customer menu reflects it.
9. Dev: refund a test paid order (AAL2) and confirm the audit trail and guest page.
10. Sign in as `kitchen` and confirm `/admin/settings`, `/admin/menu`, and unpaid orders are inaccessible.
11. Refresh `/admin/counter` directly: the SPA should load, not 404.
12. Export a CSV from History and open it in Excel/Sheets.

---

## Project map

```
src/
  components/customer/   guest menu, cart, checkout, token tracking
  components/admin/      login, MFA, counter, kitchen, menu, history, settings
  components/common/     badge, modal, config notice
  context/               cart, staff auth + idle lock, toasts
  hooks/useMenu.ts       React Query hooks + realtime invalidation
  lib/api.ts             typed Supabase data/RPC layer
  lib/supabase.ts        browser client (sessionStorage auth)
  types/index.ts         shared domain types
supabase/migrations/     schema, RLS, RPCs, menu seed, Realtime + cron
public/_headers          Cloudflare security headers/CSP
public/_redirects        SPA fallback
.github/workflows/       encrypted backup + keep-alive
BUILD_STATE.md           resumable build/deployment checklist
```

---

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| “Backend not configured” screen | Add both `VITE_` variables and restart/redeploy. |
| Staff login says “no staff profile” | Insert the user's UUID into `public.staff` with an active role. |
| Dev sees the MFA screen every time | Complete TOTP enrollment/verification; check the account's `aal` claim. |
| Kitchen screen is empty | This is correct until the counter confirms payment. Check the counter queue for unpaid orders. |
| `permission denied for function` | Re-run `0002` and `0003`; confirm the role row exists and is active. |
| Realtime not updating | Check **Database → Replication** includes `orders`, `order_items`, `menu_items`, `categories`; re-run `0005`. |
| Menu items show “sold out” after re-seeding | The seed intentionally preserves availability. Toggle the item back on in Menu. |
| Project paused | Restore it in the Supabase dashboard, then confirm keep-alive secrets are set. |
| Order stuck unpaid and cannot be paid | It may have auto-cancelled after the timeout. Check History and create a new order. |
