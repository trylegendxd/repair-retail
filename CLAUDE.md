# RepairTrace project instructions

## Repository structure

- `repairtrace-workshop/` is the shop operations application.
- `repairtrace-find/` is the customer/provider marketplace and price-search application.
- `android-wrapper/` is a small Android shell for the live RepairTrace Find URL.

Treat the web apps as separate deployable projects with separate D1 databases and R2 buckets. Inspect both whenever changing their synchronization contract.

## Required engineering behavior

- Read the relevant route handlers, schema, migrations and tests before changing code.
- Preserve existing features unless the user explicitly requests removal.
- Keep authorization and ownership checks server-side.
- Never trust role, owner, price, status, location or contact visibility decisions from the browser alone.
- Use prepared database statements and add new Drizzle migrations for schema changes.
- Preserve existing applied migrations; never rewrite migration history.
- Keep secrets in environment/secret configuration and out of source, logs, prompts and commits.
- Validate request sizes even when `Content-Length` is absent or dishonest.
- Validate uploaded photo count, size, MIME type and byte signature.
- Prevent concurrent acceptance of multiple offers for one repair announcement.
- Keep customer email and phone private until the authorized post-acceptance flow.
- Keep the generated Google Play device catalogue server-only.
- Use custom/manual device models as a fallback.
- Price estimates must be described as non-binding ranges.
- Do not deploy, change public access, migrate production data or purchase services without explicit user approval.

## Verification

For each affected web project, run:

```bash
npm run lint
npm run test:unit
npm run build
```

Also add or update focused tests for changed business rules. Report real results and remaining limitations.

## Product priorities

1. Privacy and account isolation.
2. Reliable workshop/customer/provider workflows.
3. Mobile usability and accessibility.
4. Data integrity and recoverability.
5. Clear, maintainable code and test coverage.
6. Product growth features only after core reliability.

