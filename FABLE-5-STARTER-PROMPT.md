# Ready-to-paste prompt for Claude Fable 5

You are taking over development of RepairTrace, a connected two-app electronics-repair platform. The repository root contains:

- `repairtrace-workshop/`: the private workshop/technician operating app.
- `repairtrace-find/`: the public customer and service-provider price search and repair-opportunity marketplace.
- `android-wrapper/`: Android Studio source that wraps the live customer app.
- `CLAUDE.md`: binding architecture, privacy and validation rules.
- `HANDOFF-GUIDE.md`: feature and setup documentation.

First, read `CLAUDE.md`, `HANDOFF-GUIDE.md`, both `package.json` files, both database schemas, all existing migrations, authentication helpers, server-side ownership helpers, marketplace synchronization code, and tests. Do not edit anything during this first phase.

Then:

1. Map both applications, their routes, data model, storage, authentication, uploads and integration boundary.
2. Run the existing lint and unit tests in both web apps.
3. Identify defects or missing production capabilities, ranked as critical, high, medium or low. Prioritize authorization, privacy, data integrity, race conditions, uploads, account isolation, database migrations, accessibility and mobile usability.
4. Propose a phased development plan that preserves all working behavior and the two-app architecture.
5. Recommend the single highest-value next milestone, with acceptance criteria and exact tests.

Do not deploy, publish, change hosted access, run production migrations, add paid services, rotate credentials, or expose secrets. Do not replace platform authentication or persistence without an explicit migration plan. Do not claim a feature works unless you verified it. Wait for my approval after presenting the audit and plan before implementing the first milestone.

