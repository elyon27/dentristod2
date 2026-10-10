# DENTRISTOD website — independent backend, version 2

This package preserves the captured website's original images, galleries, text,
base CSS and layout while replacing its reservation backend. It is prepared for
GitHub source control, a NEW Supabase database, and a NEW Netlify project.
It has not yet been connected to live project credentials or deployed.

## Changes

- Old `dentristod.com/sendemail.php` form action removed; submissions now go to
  the same site's `/api/reservations` Netlify Function.
- The original reCAPTCHA site key removed. Use your own NEW reCAPTCHA v2 Checkbox
  key pair, registered for the new site's hostname.
- Check Availability queries the new database; it no longer opens Airbnb or
  accidentally submits the reservation form.
- Reservation records are private: anonymous and authenticated API roles have
  no access to guest records or administrative functions. Only the server key
  can call the backend's database functions.
- Dates, input lengths, email format, CAPTCHA hostname, same-origin requests,
  request size, and a database-backed rate limit are checked on the server.
- A unique request reference prevents duplicate records on retries.
- Confirmed/blocked stays cannot overlap in the database; pending requests do
  not reserve dates. This model assumes the whole property is one rental unit.
- Original QR payment images remain manual payment options. Missing popup HTML
  references now open the existing local QR images. No payment is auto-confirmed.

## Files

- `site/`: all public website files. This is the ONLY Netlify publish directory.
- `netlify/functions/backend.mjs`: Netlify endpoint entry point.
- `server/backend.mjs`: server validation, CAPTCHA and database access.
- `supabase/migrations/202610100001_reservations.sql`: schema and private RPCs.
- `.env.example`: required configuration names, with no real credentials.
- `.github/workflows/validate.yml`: GitHub validation on pushes and pull requests.
- `tests/`: local backend tests (mocked external services).
- `DEPLOYMENT.md`: exact account setup and release sequence.

## Important operational differences

Requests are stored in Supabase, not emailed through the old host. This version
has no automatic guest or owner email notifications and no custom admin portal.
The property manager reviews requests in Supabase Table Editor, contacts the
guest, verifies the deposit manually, then changes the status to `confirmed`.
Use Supabase account access only for trusted administrators.

Maps, travel links, Facebook/Messenger, mailto contact addresses and the footer
Airbnb listing link remain informational links. They do not provide the new
reservation backend. No Airbnb calendar synchronization is implemented: record
all external-channel bookings in this database promptly before enabling online
availability. Historical bookings and emails were not present in the supplied
public capture and have not been migrated.

Do not alter the existing domain's DNS or terminate old hosting until the new
site has passed live validation and email DNS records have been documented.

## Local checks

Install Node.js 22 or newer. In this folder:

```sh
npm test
npm run build
```

The application has no npm runtime dependencies. For full local function testing,
copy `.env.example` to `.env`, use a separate TEST Supabase project, set
`SITE_ORIGIN=http://localhost:8888`, and run `npm run dev`. This downloads the
Netlify CLI. Register localhost in a separate reCAPTCHA v2 key pair. Never put
production credentials or guest data into local tests. Opening `site/index.html`
directly previews the design, but it cannot run the Netlify backend.

## Validation performed

15 local API tests passed, including failed verification, incorrect origin,
rate limits, invalid dates, unavailable dates, oversized input, missing settings
and database failure. JavaScript syntax checks passed. Original asset/base CSS
byte comparison and local file references were checked during packaging.

The SQL migration and full live integration still require a new Supabase project.
The browser-rendering check could not run because a browser runtime could not be
downloaded in this environment. No live booking, email, payment or deployment
was submitted during preparation.
