# Rugistan

React 19 + TypeScript + Vite storefront and administration console. Clerk owns sign-in; Supabase PostgreSQL/RLS and Storage own application data and media. There is no repository-owned HTTP application server. Product/order amounts are stored in the base currency (currently USD); PKR/INR are display conversions.

## Development

Use Node 24 (see `package.json`).

```sh
npm ci
cp .env.example .env.local
npm run dev
```

Set `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, and `VITE_CLERK_PUBLISHABLE_KEY`. Only publishable/legacy anon credentials belong in `VITE_` variables. Service-role and Clerk secret keys belong in operator/server environments. They are not needed to build or run the browser application.

```sh
npm run lint
npm run typecheck
npm test
npm run test:browser
npm run build
npm run check:supabase
npm run check:production
```

`check:production` requires a live Clerk key. A successful build alone does not establish release readiness. Lint currently passes with existing React lifecycle/Fast Refresh warnings; these have not been blanket-disabled.

## Database regression tests

`npm run test:db` requires Docker and an existing local Supabase PostgreSQL container (default `supabase_db_rugistan`; override `SUPABASE_TEST_CONTAINER`). It creates a uniquely named disposable database, applies every migration in filename order, runs pgTAP ownership/CRUD/checkout tests and a forced concurrent promotion-redemption test, then drops that database. Existing local/cloud user data is not reset. Storage and JWT helper schemas are minimal test fixtures; real Clerk token verification and Storage HTTP uploads still require end-to-end verification.

`pg_cron` is installed only in its configured database, normally `postgres`; the test runner validates scheduling separately in a rolled-back transaction. It does not leave a test cron job behind.

Browser fixtures intercept database responses to exercise the real dropdown, page editor and product form. Local runs also visit eight live public routes at 390/768/1440px. CI skips those three external-service smoke tests unless `RUN_LIVE_SMOKE=1`; seven deterministic component regressions still run. They do not establish successful live sign-in, admin uploads or checkout.

## Release sequence

1. Back up the hosted database and confirm its migration history. This project previously used manual dashboard SQL; do **not** blindly replay initial migrations or reset the database.
2. Review and apply `supabase/migrations/20261024050719_production_integrity.sql` against the existing matching Clerk/text-ID schema, in one transaction. It adds atomic cart/product/shipping RPCs, stronger submission policies, private guest tracking, checkout idempotency, promotion locking, expiry scheduling and monetary-unit guards. Existing orders are retained; only new pending offline orders receive a 48-hour reservation expiry.
3. Confirm the `rugistan-expire-reservations` cron job runs every 15 minutes and can execute `release_expired_reservations()`. Mark legitimately accepted orders Processing before expiry, or confirm payment. Existing pending orders are not automatically expired.
4. Configure a production Clerk instance, live publishable key, allowed origins/redirects, email verification and Supabase's Clerk third-party integration for that same instance. Local `supabase/config.toml` does not enable Clerk automatically. Verify a real Clerk JWT is accepted and cannot read another customer's orders or grant admin access.
5. **Close the guest-checkout abuse blocker.** The public `place_order` RPC still needs a trusted server-verified challenge and throttled backend path. Enforce that path at the database execution boundary so callers cannot bypass it with direct RPC requests. Frontend-only CAPTCHA is insufficient. Quantity limits, per-email pending limits and reservation expiry reduce damage but do not stop fabricated-email abuse.
6. Run all checks, `npm run check:production`, then build with the intended public production environment. Deploy `dist/` to an HTTPS static host with SPA fallback. `public/_redirects` and `_headers` support hosts that implement those files; configure equivalent rewrites/headers elsewhere. HTML should revalidate. Only fingerprinted Vite-generated assets should receive immutable caching; original photo paths can change.
7. Test sign-up/verification/sign-in/out, both account roles, product/media CRUD, all payment/delivery options, promotion failures, failed-network checkout retries, private guest tracking, cancellation/restocking and responsive navigation against the deployed URL. Confirm backups, alerting, error collection and the reservation scheduler operationally.

Apply the migration **before releasing this frontend**; new RPC-dependent saves intentionally surface errors if the backend is older. No hosted migrations or deployment were performed by the production audit because administrative Supabase CLI access was unavailable.

### Guest tracking compatibility

New guest confirmations expose a private link whose fragment contains the high-entropy order UUID. Keep that link private. Lookup requires the order number, email and private key. Older guests without a saved key must contact the store; authenticated owners retain access to their orders. Sequential order numbers plus a known email no longer suffice after the migration.

### Payments and notifications

Checkout supports the enabled offline methods configured in store settings. No card gateway or order-email delivery integration is implemented. Do not advertise automatic payment capture or order emails until those providers and verified server-side callbacks exist. Order confirmation copy reflects receipt and actual payment status.

### Administrator provisioning

```sh
node scripts/create-admin.mjs verified-email@example.com user_existingClerkId
```

Requires server-only `SUPABASE_SERVICE_ROLE_KEY` and `CLERK_SECRET_KEY` plus the matching Supabase URL. It verifies that email against an existing Clerk identity before granting the database role; it does not create accounts or reset passwords. Existing admins are preserved. API reference: https://clerk.com/docs/reference/backend-api

Never put private payment credentials in `settings`: storefront-facing store/payment settings are public. Keep gateway credentials in a trusted backend secret store.

Customized Clerk screens pin `@clerk/ui` through the provider so remote UI releases cannot silently change their structure. Upgrade and test that dependency deliberately. Reference: https://clerk.com/docs/reference/components/versioning
