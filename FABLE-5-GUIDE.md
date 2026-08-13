# Using this project with Claude Fable 5

Fable 5 is a Claude model rather than a separate app-import format. The most useful way to give it this project is through Claude Code, because Claude Code can read the source tree, edit files and run tests.

## 1. Extract the package

On Ubuntu/Linux:

```bash
unzip RepairTrace-Complete-2026-08-13.zip
cd RepairTrace-Complete
```

## 2. Start Claude Code from the package root

```bash
claude
```

Select **Fable 5** as the model if it is available on your plan. Starting at the package root matters: it lets Claude see `CLAUDE.md` and both app folders. Claude Code reads project files as needed; you do not need to paste the entire codebase into the chat. Anthropic describes Fable 5 as suited to ambitious, long-running coding work, which is why the included prompt begins with a cross-app audit instead of asking for a blind rewrite.

If you start Claude from inside one app, add the other directory when a task needs both:

```text
/add-dir ../repairtrace-find
```

or, from the customer app:

```text
/add-dir ../repairtrace-workshop
```

## 3. Initialize project memory carefully

The included root `CLAUDE.md` already explains the two-app architecture and safety rules. You can run:

```text
/init
```

If Claude suggests changes, ask it to improve the existing file rather than overwrite product rules.

## 4. Paste the starter prompt

Open `FABLE-5-STARTER-PROMPT.md`, copy the prompt, and paste it into Claude Code. It tells Fable 5 to inspect and test before editing.

## 5. Use one bounded task at a time

Good follow-up prompts:

```text
Implement Portuguese and English localization in both apps. Preserve all routes and database behavior. First list every user-facing string and propose the translation structure; then implement it and run tests in both projects.
```

```text
Add secure in-app messaging that starts only after a customer accepts a provider offer. Design the D1 migration and authorization rules first. Do not expose customer contact data in public/provider feeds.
```

```text
Audit the customer/provider marketplace for authorization, race-condition, upload and privacy bugs. Do not change code yet. Return findings ranked by severity with exact files and a test plan.
```

```text
Make RepairTrace Find Play Store ready using the android-wrapper folder. Preserve the live URL, back navigation and external-link restrictions. Add build instructions, release signing documentation and tests; never create or commit a signing key.
```

## 6. Require verification

End implementation prompts with:

```text
Before finishing, show the changed files and run the relevant lint, unit tests and production build. Do not claim success if any command fails. Do not deploy, publish, migrate production data or change secrets without asking me first.
```

## 7. Keep the two projects coordinated

When a feature changes data shared between the workshop app and RepairTrace Find, tell Claude to inspect both sides. Shared concepts include device model keys, repair categories, public price samples and marketplace synchronization.

Do not let it silently merge databases, replace the hosting system, or rewrite authentication. Those are major migrations requiring an explicit plan, data migration and rollback strategy.

## 8. What not to paste into Fable 5

- API keys, passwords, access tokens or signing keys
- real customer records or photos
- production database exports containing personal data
- private SMS/email credentials

Use redacted test data and platform secret settings instead.

## 9. Git workflow

Before a major task:

```bash
git init
git add .
git commit -m "Import RepairTrace handoff"
git switch -c feature/my-change
```

Then ask Claude to work on the feature branch. Review `git diff`, test, and commit only when satisfied. Each included web app came from its own hosted Git history; the export intentionally contains source snapshots without hidden credentials or remote configuration.

## 10. If using Claude.ai rather than Claude Code

Create a Claude project, upload this ZIP if the interface accepts archives, and also paste the contents of `CLAUDE.md` into the project's instructions. If archive contents are not expanded automatically, upload only the relevant app source or connect a Git repository. Claude Code is preferable for actual multi-file edits and command execution.
