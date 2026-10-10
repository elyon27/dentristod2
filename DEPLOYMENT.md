# Deploy a new, independent DENTRISTOD platform

Status: source package ready; remote repository/project creation and live
configuration remain pending. Do not reuse the existing site's database keys.

## 1. GitHub

Repository: `elyon27/dentristod2` (created by the owner; public).
The authenticated account is `elyon27`. The new repository was verified before upload.

Create a new private repository in GitHub. Use GitHub Desktop to add this extracted
folder as a local repository, commit it, and publish it to the new private repo.
Alternatively, with Git and GitHub CLI installed and signed in:

```sh
git init -b main
git add .
git commit -m "Prepare DENTRISTOD independent Supabase and Netlify backend"
git remote add origin https://github.com/elyon27/dentristod2.git
git push -u origin main
```

Run these inside the folder containing `package.json` and `netlify.toml`, not in
`site/`. Never commit `.env`; it is ignored. No actual repository was created
by this package. GitHub Actions checks the code; Netlify's Git integration
performs deployments after that integration is connected.

## 2. Supabase

Select the organization and review the project's quoted costs before creating it.
Suggested project name: `dentristod-platform`; suggested region: Singapore
(`ap-southeast-1`). The connected account exposes `Rev 7 Org`; the owner approved that organization for this new project.

1. Create the NEW project and wait until healthy.
2. Run `supabase/migrations/202610100001_reservations.sql` once in its SQL Editor.
   Use a fresh database; the migration is intentionally not destructive and will
   fail rather than replace existing tables with the same names.
3. Copy its project URL and a server SECRET API key into Netlify settings only.
   The browser does not need a Supabase publishable key.
4. Import all existing future bookings and property closure periods. Use status
   `confirmed` for confirmed reservations, `blocked` for closures. Use genuine
   booking data, not sample guests. Supply a UUID `request_id` for each imported
   row. For a closure use property contact details and an explanatory message.
5. Keep `AVAILABILITY_READY=false` until the dates have been reconciled.

Checkout is exclusive: a Jan 1–3 booking allows the next check-in on Jan 3.
The database refuses overlapping confirmed/blocked stays for the whole property.
Multiple pending requests can overlap; only one can later be confirmed.

## 3. New reCAPTCHA ownership

At https://www.google.com/recaptcha/admin/create register a NEW reCAPTCHA v2
"I'm not a robot" Checkbox application. Add the new Netlify hostname. Add the
custom domain only when you control it and are ready to use it. Copy the site
key and secret key to Netlify. The old site's embedded key is not used anywhere.

## 4. Netlify

Create a NEW Netlify project by importing the new GitHub repository.
Choose the correct Netlify team. Use:

- Production branch: `main`
- Base directory: repository root (blank)
- Build command: `npm run build`
- Publish directory: `site`
- Functions directory: `netlify/functions`

`netlify.toml` already contains these settings. Do not use a static drag-and-drop
upload of `site/` alone: that omits the server functions.

Set environment variables with Functions scope (or all scopes):

| Variable | Value |
| --- | --- |
| SUPABASE_URL | New project's HTTPS URL |
| SUPABASE_SECRET_KEY | New project's `sb_secret_...` key; legacy service_role also supported |
| SITE_ORIGIN | Exact new public origin, e.g. `https://your-site.netlify.app`, no path |
| RECAPTCHA_SITE_KEY | New reCAPTCHA v2 site key |
| RECAPTCHA_SECRET_KEY | Matching secret key |
| RATE_LIMIT_SECRET | Random secret of at least 32 characters |
| AVAILABILITY_READY | `false` until existing reservations are reconciled; then `true` |

Generate the rate-limit secret locally with Node:

```sh
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Treat all keys except the reCAPTCHA site key as server-only. Do not paste secret
keys into a public repository or public chat. Redeploy after settings change.
Use a separate test database/settings for previews. Production `SITE_ORIGIN`
intentionally rejects submissions from other preview domains.

## 5. Live validation before switching the custom domain

- Confirm GitHub checks and the Netlify deployment finish successfully.
- Inspect `/api/config`: only readiness and the public CAPTCHA site key appear.
- Check the site on desktop and phone and confirm galleries/QR popups work.
- After importing real existing bookings, enable availability and redeploy.
- Check a blocked date: it must be unavailable. Check a genuinely free date.
- Submit ONE clearly labeled test request with a contact address you control.
- Verify the matching row exists in Supabase with status `pending` and the same
  reference. No email delivery or booking confirmation is implied by this.
- Confirm a controlled test reservation; overlapping dates must be rejected.
  Cancel the test record afterward. Do not disturb genuine guest records.
- Verify anonymous REST access cannot read `reservations` or call the RPCs.
- Confirm the new page has no traffic to the previous `sendemail.php` endpoint.

Only after validation: attach the desired domain to the new Netlify project,
update `SITE_ORIGIN` and reCAPTCHA allowed domains, redeploy, and update web DNS.
Preserve existing MX/TXT mail records for `dentristod.com` email services.
Do not delete the old hosting account or database as part of this cutover.

## 6. Everyday administration

In Supabase Table Editor, review `public.reservations`, newest first.
Use `pending`, `confirmed`, `cancelled`, or `blocked`. Confirm after direct
communication and manual deposit verification. Update the new calendar whenever
an Airbnb or other external booking is accepted. This is not a channel manager.

## Official references used

- https://docs.netlify.com/build/functions/configuration/
- https://docs.netlify.com/build/functions/environment-variables/
- https://docs.netlify.com/build/functions/api/
- https://supabase.com/docs/guides/getting-started/api-keys
- https://supabase.com/docs/guides/database/postgres/row-level-security
- https://developers.google.com/recaptcha/docs/verify
