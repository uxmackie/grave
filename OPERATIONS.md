# Operations

This is the production runbook for Grave. The app is a Cloudflare Worker with a
D1 database (`DB`) and an R2 bucket (`BUCKET`). The reader is public; all editor
writes require the `EDITOR_PASSWORD` secret and an HttpOnly session.

## Environments

| Environment | Data | Config | URL |
| --- | --- | --- | --- |
| Local | `.wrangler/state` | `.dev.vars`, `wrangler.local.json` | `http://127.0.0.1:5173` |
| Production | D1 + R2 | Worker secrets, `wrangler.production.json`, `GRAVE_COMMIT` var | Worker/custom domain |

Local setup:

```powershell
npm install
npm run setup:local
npm run dev
```

`.dev.vars` is generated locally and is ignored by git. Never reuse its password
in production. `wrangler.production.json` contains environment-specific resource
IDs and is also ignored by git.

## CI gates

Every pull request and every push to `master` runs `.github/workflows/ci.yml`:

```text
npm ci
npm run typecheck
npm test
npm run build
npx playwright install --with-deps chromium
npm run test:browser
```

The browser suite starts its own dev server when one is not already healthy,
creates a local password if needed, and covers reader, editor, publishing,
media, accessibility, and quality-panel behavior. Artifacts from a failed run
are uploaded for seven days.

## Required production configuration

Secrets:

- `EDITOR_PASSWORD` — required. If absent, the editor fails closed with `503`.
- `SESSION_EPOCH` — optional. Change it to revoke every existing editor session.
  Session hashes include this value, so no database cleanup is needed.
- `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` — only needed for CLI
  deploys or backups, not by the Worker at runtime.

Vars:

- `GRAVE_COMMIT` — the deployed commit, surfaced by `/api/health`.

The production Worker config is generated from
[`wrangler.production.example.json`](wrangler.production.example.json) by
`npm run deploy:prepare`. It expects the Worker entry at
`dist/server/index.js` and static assets at `dist/client`.

## First deployment

Create the production resources once:

```powershell
npx wrangler d1 create grave-production
npx wrangler r2 bucket create grave-media
```

Copy the D1 UUID from the output. Then prepare and deploy:

```powershell
$env:D1_DATABASE_ID = "<production-d1-uuid>"
$env:D1_DATABASE_NAME = "grave-production"
$env:R2_BUCKET_NAME = "grave-media"
$env:GRAVE_COMMIT = (git rev-parse --short HEAD)

npm ci
npm run typecheck
npm test
npm run build
npm run deploy:prepare
```

Apply the checked-in migrations to the remote database:

```powershell
npx wrangler d1 migrations apply DB --remote --config wrangler.production.json
```

Deploy the first Worker version:

```powershell
npx wrangler deploy --config wrangler.production.json
```

Now set the editor secret and verify the site:

```powershell
npx wrangler secret put EDITOR_PASSWORD --config wrangler.production.json
npx wrangler secret put SESSION_EPOCH --config wrangler.production.json   # optional
Invoke-WebRequest https://<worker-or-domain>/api/health
```

A healthy response is HTTP 200 with `"status":"ok"` and `"database":"ok"`.
After the first deployment, `npm run deploy` builds, prepares, and deploys in
one step. It does **not** apply database migrations; run the migration command
above first whenever `drizzle/` changes. `npm run deploy:check` performs the same
preparation followed by a Wrangler dry run.

If this project is deployed through the Sites platform instead, use the
platform's deploy action, bind D1 `DB` and R2 `BUCKET` there, set
`EDITOR_PASSWORD` in the platform secrets, and apply the remote migrations. The
CLI path above is the direct Workers path.

### Migrations

Migrations live in `drizzle/`. Never edit an applied migration. Generate a new
one from `db/schema.ts`:

```powershell
npm run db:generate
```

Review the SQL before applying it. Production migrations run with:

```powershell
npx wrangler d1 migrations apply DB --remote --config wrangler.production.json
```

Wrangler records the current D1 version for Time Travel, but that is not a
substitute for an export. Still take a manual export before an unusually risky
schema change.

## Security posture

`build/sites-worker.ts` applies security headers to every dynamic response.
`public/_headers` applies the same core policy to static assets and adds
long-lived caching for hashed assets. HSTS is only sent over public HTTPS.

CSP currently ships in report-only mode
(`Content-Security-Policy-Report-Only`). Review CSP violations in the browser
console on a production preview; no report collector is configured yet. Remove
any remaining inline or third-party needs, then rename it to enforcing
`Content-Security-Policy`. Do not enforce it untested; RSC hydration and the MDX
renderer rely on inline bootstrap scripts.

Other controls:

- HttpOnly, `SameSite=Strict` editor sessions; `Secure` on HTTPS.
- Same-origin checks on all state-changing requests.
- Login throttling after eight failed attempts per IP in 15 minutes.
- Product media remains private until published; public media is product-scoped.
- API and error responses are `no-store`.
- Server errors return a generic message in production and log structured JSON.
- Client error reports are capped at 8 KB, same-origin only, and logged without
  request bodies. `POST /api/errors` deliberately stores no user content.

To force every editor session to sign out immediately:

```powershell
npx wrangler secret put SESSION_EPOCH --config wrangler.production.json
```

To disable editing entirely during an incident, delete `EDITOR_PASSWORD`. The
reader remains available.

## Monitoring

- `GET /api/health` — unauthenticated, no-store; checks D1 and returns 200/503.
  Point an external uptime monitor at this endpoint.
- Workers Logs — enabled in the generated Worker config. Server failures and
  client error reports are structured JSON. Use Logpush if logs must be retained
  longer than the dashboard default.
- Cloudflare Web Analytics — enable it in the dashboard for the Worker or custom
  domain. No analytics token is embedded in the app.
- Check response headers after a deploy:

```powershell
curl.exe -I https://<worker-or-domain>/
```

Expect `Strict-Transport-Security`, `X-Content-Type-Options`,
`Referrer-Policy`, `Permissions-Policy`, and
`Content-Security-Policy-Report-Only` on HTML.

## Backups

### Local

```powershell
npm run db:backup:local
```

This writes `backups/<timestamp>/d1.sql`, a copy of local R2 state under `r2/`,
and `manifest.json`. Stop the dev server before restoring a snapshot.

Local restore (replace `<timestamp>`):

```powershell
Move-Item .wrangler/state/v3/d1 .wrangler/state/v3/d1.before-restore
Move-Item .wrangler/state/v3/r2 .wrangler/state/v3/r2.before-restore
npx wrangler d1 execute DB --local --config wrangler.local.json --persist-to .wrangler/state --file backups/<timestamp>/d1.sql --yes
Copy-Item backups/<timestamp>/r2 -Destination .wrangler/state/v3/r2 -Recurse
npm run dev
```

Verify `/api/health`, a reader page, and editor login before deleting the
`.before-restore` directories.

### Production

D1 export:

```powershell
npx wrangler d1 export DB --remote --config wrangler.production.json --output backups/production-<timestamp>.sql
```

D1 Time Travel is the fastest point-in-time recovery path:

```powershell
npx wrangler d1 time-travel info DB --remote --config wrangler.production.json
npx wrangler d1 time-travel restore DB --timestamp <timestamp> --remote --config wrangler.production.json
```

R2 media is not included in D1 exports. Enable object versioning on the
production bucket in the Cloudflare dashboard, or sync it to a separate backup
bucket with an S3-compatible tool. Test a restore periodically; an untested
backup is not a backup.

Before a destructive restore, disable editor writes by deleting the
`EDITOR_PASSWORD` secret, take a final export, restore D1/R2, then set the secret
again. Publication payloads are stored as JSON blobs in D1, so the D1 export is
the source of truth for content. Local Markdown mirrors under `content/` are a
convenience copy, not a production backup.

## Rollback

List recent Worker versions:

```powershell
npx wrangler deployments list --config wrangler.production.json
```

Roll back the Worker code:

```powershell
npx wrangler rollback <version-id> --config wrangler.production.json --yes --message "Incident rollback"
```

Database changes are separate from Worker rollback. If a migration caused the
incident, restore D1 with Time Travel or the pre-migration export, then redeploy
the matching Worker version. Re-enable `EDITOR_PASSWORD` only after the health
check and a reader smoke test pass.

## Known gaps before public launch

- No production account/resources or custom domain have been configured yet.
- CSP is report-only until a production preview review is complete. No CSP
  report collector is configured yet; add `report-uri`/`report-to` handling
  before enforcing it.
- Cloudflare Web Analytics and external uptime alerting must be enabled in the
  Cloudflare dashboard.
- Client errors are available in Workers Logs; no third-party error service or
  long-term log sink is configured.
- R2 production backup/versioning must be enabled and restore-tested.
- Products are stored as JSON blobs with optimistic revisions. Very large
  products still risk D1 row-size and write-amplification limits; monitor D1
  storage and export before growing a product substantially.
