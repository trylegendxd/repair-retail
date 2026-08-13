# RepairTrace complete project handoff

This package contains the latest saved source for both RepairTrace applications as of 13 August 2026.

## Package contents

### `repairtrace-workshop/`

The original RepairTrace application for repair shops and technicians.

- Live application: https://repairtrace-app.trylegendxd.chatgpt.site
- Repair intake and status workflow
- Customer records and private repair tracking links
- Email/SMS notification integration points
- Diagnosis, parts, checks, photos, event history and certificates
- AI repair estimates, repair intelligence and iFixit guide/parts integration
- Quotes, invoices, marketplace contribution and operations tools
- Cloudflare D1 structured data, R2 photo storage and Drizzle migrations

### `repairtrace-find/`

The public customer and service-provider marketplace.

- Live application: https://repairtrace-find.trylegendxd.chatgpt.site
- Public repair-price search and installable PWA
- Customer and provider accounts
- Customer repair announcements with location and up to five photos
- Nearby provider opportunity feed and private price-range offers
- Offer acceptance, contact privacy and activity history
- More than 26,000 searchable electronics models
- Google Play supported-device import/update script
- Cloudflare D1 structured data, R2 photo storage and Drizzle migrations

### `android-wrapper/`

Android Studio source for a lightweight native wrapper around the live RepairTrace Find application. It is included so another coding tool can rebuild an APK. The live customer app is also installable directly as a PWA from Android browsers.

### `CLAUDE.md` and `FABLE-5-STARTER-PROMPT.md`

These provide Claude Code / Claude Fable 5 with the product rules, architecture and a safe first task. Keep `CLAUDE.md` at the package root.

## Important architecture

Both web apps use:

- TypeScript, React 19 and Next-compatible Vinext
- Vite and Cloudflare Workers
- D1 for relational data
- R2 for uploaded photos
- Drizzle schemas and checked-in SQL migrations
- Platform-provided Sign in with ChatGPT identity in the hosted versions

The two apps are separate projects and databases. Their server-to-server marketplace link uses:

- `REPAIRTRACE_FIND_URL`
- `REPAIRTRACE_FIND_SYNC_KEY`

Never put secrets into source code or commit them. Values present in `.env.example` are names only, not credentials.

## Run locally on Ubuntu/Linux

Install Node.js 22.13 or newer. Then choose one app:

```bash
cd repairtrace-workshop
npm ci
npm run dev
```

or:

```bash
cd repairtrace-find
npm ci
npm run dev
```

The local runtime uses simulated D1/R2 bindings. To check code quality:

```bash
npm run lint
npm run test:unit
npm run build
```

Local development uses one safe preview identity. Production account separation depends on the hosting layer forwarding the authenticated email header used by the existing auth helpers. If you move the apps away from their current host, implement a replacement identity provider and server-side session layer before exposing them publicly; do not simply disable the existing checks.

For RepairTrace Find, refresh the source-backed device catalogue with:

```bash
npm run catalog:update
```

That command downloads Google Play's public supported-device CSV and regenerates `lib/generated/google-play-devices.ts`.

## Database changes

Edit `db/schema.ts`, then generate a migration:

```bash
npm run db:generate
```

Read the generated SQL under `drizzle/` before deploying. Never delete or rewrite old applied migrations. Add a new migration.

## Hosted integrations

The workshop app recognizes these optional variables:

```text
RESEND_API_KEY
REPAIRTRACE_FROM_EMAIL
REPAIRTRACE_PUBLIC_URL
TWILIO_ACCOUNT_SID
TWILIO_AUTH_TOKEN
TWILIO_MESSAGING_SERVICE_SID
TWILIO_FROM_NUMBER
REPAIRTRACE_FIND_URL
REPAIRTRACE_FIND_SYNC_KEY
```

Email/SMS sending remains inactive until valid provider credentials and a verified sender are configured. Do not give an AI assistant credentials in a prompt; add them through the deployment platform's secret manager.

The ZIP contains application source plus schema and migration history. It does not contain production D1 records, R2 customer photos, user sessions, provider credentials or signing keys. Those are intentionally excluded for privacy and security.

## Product rules that must remain true

1. Workshop data must be isolated by the authenticated workshop owner.
2. A customer account posts repair needs; a provider account sends offers.
3. Each signed-in email owns one RepairTrace Find account role. Another email can create another independent account or role.
4. Customer email and phone stay hidden from opportunity feeds. Contact is disclosed only after the customer accepts an offer, according to the existing flow.
5. Mutating endpoints must check authentication, ownership and same-origin protections on the server.
6. Uploaded files must keep size, count, MIME and byte-signature validation.
7. One repair announcement can have at most one accepted offer, including under concurrent requests.
8. Price ranges are estimates, not guaranteed quotes.
9. The large generated catalogue must stay server-only so it does not inflate the browser bundle.
10. Preserve both apps and their integration instead of merging them without a migration plan.

## Recommended next development work

Ask the coding assistant to begin with an audit, tests and a written plan. High-value next steps are:

- provider verification and moderation tools;
- in-app messaging after an offer is accepted;
- push/email notification jobs for new nearby opportunities and offer updates;
- real geocoding rather than relying only on browser coordinates and text cities;
- Portuguese localization;
- shared API contracts between both apps;
- error monitoring, analytics and audit logs;
- export, deletion and privacy controls for account data;
- Play Store-ready Android packaging, signing and release automation.

## Android wrapper

Open `android-wrapper/` in Android Studio. Allow it to install the requested Android SDK/Gradle components, then use **Build > Build APK(s)**. For a production Play Store release, replace the generic app icon, choose a permanent application ID, create and securely retain a signing key, add a privacy policy, and use an Android App Bundle (`.aab`).

The wrapper loads the existing live site and restricts navigation to RepairTrace Find. Because the business logic remains on the web app, published web updates appear without rebuilding the wrapper. A network connection is required for live marketplace functions.

## Before accepting AI-generated changes

- Review the diff.
- Confirm no secret was committed.
- Run lint, unit tests and the production build in both affected apps.
- Test anonymous price search, customer registration/posting, provider registration/opportunities/offers, offer acceptance and workshop tracking.
- Back up production data before migrations.
- Deploy one project at a time and verify it before changing the second.
