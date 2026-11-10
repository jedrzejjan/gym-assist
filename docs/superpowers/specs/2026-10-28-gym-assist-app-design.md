# Gym Assist app: design

Date: 2026-10-28
Status: approved 2026-10-28, updated 2026-11-10 (Stage 1 kickoff decisions)

## 1. Purpose

Gym Assist is an Android app for a personal trainer to log training sessions and track progress, for their clients and for themselves. The trainer is the only user. Each client, including the trainer, is a profile in the app.

The project has three aims:

1. **Build the app.** First as an APK on the trainer's own phone, later on the Play Store.
2. **Run it like a business.** Jira for stages and tickets, GitHub with CI/CD, MCP connections to external tools, and a product that could one day be sold.
3. **Learn how an AI coding agent works.** Claude codes every ticket, and a Claude review subagent reviews the code. The user is the product owner and reviews high-level decisions: product, design, architecture and business. Jira records how Claude splits work into smaller tasks.

### Success criteria

- The trainer runs a real session with the app and needs no CSV file or Python script.
- Every stage and ticket, and the split of tickets into sub-tasks, is visible in Jira.
- Every change reaches `main` through a pull request with green CI and an approving review from the review subagent. A PR that needs owner approval (section 8) also has the user's approval.

### Out of scope

- Rehabilitation logic. The app tracks training and progress. It is not a rehab app.
- AWS. This project does not use AWS.
- Client logins, iOS builds and a server in the MVP.

## 2. Decisions

| Topic | Decision |
|---|---|
| Users | One trainer account, no login. Clients are profiles. The trainer is the first profile ("Me"). |
| Units | Kilograms and centimetres only. |
| App stack | React Native + Expo + TypeScript |
| Platform | Android. iOS stays possible later from the same code. |
| Data | Local-first: SQLite on the phone. No server in the MVP. |
| Repo and CI/CD | GitHub, GitHub Actions |
| Project management | Jira Cloud Free, Scrum project with key `GYM` |
| UX design | Penpot, with its official MCP server |
| Builds | EAS Build, manual trigger only |
| Server | A backlog item. Chosen later. |
| Terraform | First ticket after the MVP |

## 3. Stages

Each stage is a Jira epic.

### Stage 0: Foundations

- Turn this folder into a GitHub repo. The Python tool and its docs move to `legacy/` as the reference implementation.
- Create the Jira Scrum project `GYM` with epics and a backlog.
- Connect the MCP servers: Atlassian (Jira), GitHub and Penpot.
- Set up CI, branch protection and the manual build workflow (section 7).
- Create the Expo project skeleton with the folder layout from section 5.

### Stage 1: UX design (Penpot)

Stage 1 can overlap with Stage 0.

1. User flows, starting with the log-session flow in section 4.
2. Low-fidelity wireframes, discussed screen by screen.
3. A clickable prototype of the log-session flow.

Done when the user approves the designs. Each MVP ticket links to its Penpot board.

### Stage 2: MVP on the phone

Two 2-week sprints:

- **Sprint 1:** local database and migrations, exercise library with seed data, clients with their profile, log session. Result: a real session can be logged on the phone.
- **Sprint 2:** history (including editing and deleting a finished session), recovery, progress, CSV import of the existing history, and the backup plan in section 5: JSON export, automatic backups, restore. Result: the app replaces the Python tool.

**Done when:**

- the APK is installed on the user's phone;
- the user has logged three real sessions with it;
- the recovery screen matches `python legacy/gym_tracker.py status` for the same data;
- a backup restores correctly on a reinstalled app;
- CI is green.

### Stage 3: Backlog after the MVP

The order can change when the user reprioritises, but Terraform stays first. In priority order:

1. **Terraform for the GitHub repo.** Bring the existing repo, branch protection, labels and security settings under Terraform with `terraform import`. Use the `integrations/github` provider. Keep the state outside git (HCP Terraform free tier, or local state with backups; check the current limits at setup). Keep `EXPO_TOKEN` out of Terraform. Infra PRs run `terraform fmt -check`, `validate` and `plan`. The user runs `apply` by hand.
2. **Plan a session in advance and run it live** (GYM-55, High). Before meeting a client, the trainer prepares the session: exercises and target sets. During the meeting they follow the plan and log it, and can change anything on the fly: swap an exercise or its variation, change weight or reps, add or remove exercises. It reuses the log-session screens. One possible model (to be designed, not decided): a planned session is a session with targets filled in ahead of time; a `planned` status would also need a rule next to the one-draft rule.
3. **Add exercise page.** Lets the trainer create a custom exercise (`is_custom = 1`) with names, category, training type, pattern and muscles.
4. **Extra set properties per exercise.** UI for box height, cardio speed and minutes, and set notes. The columns already exist (section 6).
5. **Left and right side (L/P) for sets.** The UI for the `side` column.
6. **Choose and add a server.** For backup beyond the phone, sync across devices, and client logins. Candidates: Supabase, Firebase, AWS, Cloudflare Workers + D1, Google Cloud Run.
7. Progress curve charts.
8. "What should I train today?" suggestion.
9. End-to-end UI tests with Maestro.
10. CI extras: EAS Submit to the Play Store, EAS Update (over-the-air updates), release notes generated from commit types.
11. Full Polish translation of the UI.
12. **One-month training plan** (GYM-56). A month of planned sessions for a client, built on item 2.
13. **Extend the client profile with an intake questionnaire** (GYM-57). The user prepares the questions. It may hold health information, so it needs the GDPR basics (item 17) first.
14. **Body measurements** (GYM-58): waist, biceps, legs and more, as new types in the `measurements` table (section 6).

The items below came from a review of this spec, not from the user. In Jira they get the label `ai-generated`. Items 16 to 20 also get priority Low.

15. **Test and CI hygiene** `[AI generated]`
    - Run the data tests on `better-sqlite3` through Drizzle, because `expo-sqlite` does not run in Jest. Write down that Node's SQLite can behave slightly differently from the phone's.
    - Add a migration test that upgrades a database with realistic data from schema version N to N+1.
    - Set a coverage threshold of about 90% for `domain/` only.
    - Make Dependabot ignore Expo-managed packages, and upgrade those with `npx expo install --fix`.
16. **Soft deletes for sync** `[AI generated, Low]`. Part of the server work in item 6. Add `deleted_at` or a tombstone table, designed for the chosen server. Until sync exists, deletes stay hard deletes, because there is no other device to tell.
17. **App lock and GDPR basics** `[AI generated, Low]`
    - PIN or fingerprint lock with `expo-local-authentication`.
    - A privacy notice and a client consent note.
    - Export and delete of all data for one client.
    Recommended before the first real client's data goes into the app.
18. **EAS build status in GitHub** `[AI generated, Low]`. With `--no-wait`, a failed EAS build still shows green in GitHub. For now the failure shows on expo.dev and by email. This item reports the result back to GitHub, by polling `eas build:view` or through an Expo webhook.
19. **Architecture Decision Records** `[AI generated, Low]`. Short records in `docs/adr/` of the key decisions: Expo over Kotlin, local-first, no AWS, Penpot, Terraform timing. The user writes the "no AWS" reason.
20. **Expo SDK upgrade routine** `[AI generated, Low]`. A recurring chore for each new Expo SDK release: upgrade, run `npx expo install --fix`, run the tests, check on the phone.

### Stage 4: Play Store

- Google Play developer account (one-time fee, paid by the user).
- Privacy policy and GDPR basics. Client data can include health information.
- `production` build as an AAB, with Play App Signing.
- Internal testing track, then a closed test with the number of testers Google requires (currently about 12), then production.
- Monetisation options are decided at this stage.

## 4. Log-session flow

1. **Choose a client.** "Me" is a normal client.
2. **Start a session.** The date is today by default and can be changed.
3. **Choose an exercise** in one of two ways:
   - by movement pattern, then an exercise from that pattern;
   - from the full exercise list, with search.
   A third way, "New exercise", opens the Add exercise page. It is a backlog item.
   When an exercise is chosen, the screen shows that client's sets from the last session that had this exercise, for example "Last time: 60 kg × 8, 60 kg × 8, 62.5 kg × 6". If there is none, it shows "First time".
4. **Add a set:** weight and reps. Both may be left blank.
   - **Edit a set:** tap a logged set to change its weight or reps.
   - **Delete a set:** removes the row. The remaining sets keep their numbers, and the next new set gets the next number.
5. **Keep adding sets.** "Finish exercise" is available after any number of sets.
   A finished exercise can be opened again to add, edit or delete sets.
6. **Back on the choose-exercise page**, the trainer chooses the next exercise as in step 3. This page also shows:
   - **Finish session:** saves the session as finished.
   - **Reorder exercises:** move an exercise up or down in the session's list.
   - **Remove an exercise:** asks "Remove this exercise and its sets?" and, if confirmed, deletes it.
   - **Cancel session:** asks "Discard this session?" and, if confirmed, deletes the draft.

The session is saved as a draft after every set. If the app closes or the phone dies, the trainer continues the draft where they left off.

**Finishing needs an exercise.** "Finish session" is available once the session has at least one exercise. A session with no exercises can only be cancelled.

**Editing a finished session.** From a client's history, the trainer can open a finished session and change it with the same screens: its date, its exercises and their order, and its sets.
- Every change is saved at once, as in a draft. There is no separate Save step.
- The session stays finished and does not count as a draft, so it can be edited while a draft is open elsewhere.
- Removing the last exercise asks "Delete this session?" instead, because a finished session must have at least one exercise.
- "Delete session" asks "Delete this session? This cannot be undone."
- Recovery and progress update by themselves, because they are computed from sets.

**One draft at a time.** Only one draft session can be open in the whole app. If the trainer starts a session while a draft exists, for the same client or another one, the app asks: "Resume", "Finish it" or "Discard it". Discard uses the same "Discard this session?" confirmation.

## 5. Architecture

Three layers. Each layer depends only on the layer below it.

```
app/        screens and navigation   (Expo Router, React components)
  ↓ calls
data/       reading and saving       (expo-sqlite + Drizzle ORM)
  ↓ uses
domain/     training logic           (plain TypeScript functions, no UI, no database)
```

### `domain/`: training logic ported from `gym_tracker.py`

- `recovery.ts` turns the last date a pattern or muscle was trained into a status. The thresholds are the same as `recovery_label` in the Python tool. Days are **calendar days** between the session date and today's date on the phone, not 24-hour periods, because sessions store a date only:
  - 0 or 1 days: "recovering, too soon";
  - 2 or 3 days (exactly 3 counts here): "in supercompensation window (48–72 h)";
  - 4 days or more: "due";
  - never trained: "never logged".
  Only finished sessions count. A draft does not.
- `progress.ts` holds the Epley estimated one-rep max (`weight` when reps = 1, otherwise `weight × (1 + reps / 30)`) and the best set per exercise. The best set is ranked by e1RM, then reps. Sets without weight or reps are not compared.
- `sets.ts` gives the next set number in a session exercise and the display format, where a blank value shows as "-".
- `catalogue.ts` holds the fixed lists:
  - categories: KD, HD, Push, Pull, Core;
  - training types: Strength, Plyometric, Power, Cardio;
  - movement patterns: KD, HD, Push vertical, Push horizontal, Pull vertical, Pull horizontal, Anti flexion, Anti extension, Carries, none;
  - the 12 muscles with English and Polish names.

All domain functions are pure: data in, result out.

### `data/`

- SQLite on the phone through `expo-sqlite`, with Drizzle ORM for typed queries and versioned migrations. A migration must upgrade existing data without loss.
- **Seed:** the exercise library from `exercises.csv`, loaded on first start.
- **Import:** a one-time CSV import of the existing history (section 6).
- **Export:** JSON export of all data, on demand.

### Backup plan

The trainer must not need to remember anything. No backup step depends on a manual action.

Installing a new APK over the old one keeps the app's data, as long as the app is updated and not uninstalled and the build uses the same signing key. The real risks are:

- a schema migration that goes wrong;
- an uninstall;
- a lost or broken phone.

| Layer | What it does | Protects against |
|---|---|---|
| **Pre-migration snapshot** | On start, before running any migration, the app copies the database file to `backups/pre-migration-v<N>.db` inside the app. It keeps the last 3 snapshots. If the migration fails, the app restores the snapshot and shows an error instead of opening a broken database. | Data loss from an app update |
| **Automatic export after every change to finished data** | After "Finish session", and after any change to a finished session, a client's profile or a weight entry, the app writes a full JSON export to a folder the trainer picks once, through Android's folder picker. The folder can be a Google Drive folder. The file name is `gym-assist-backup-YYYY-MM-DD.json`, and the app keeps the last 10 files. Several changes on the same day overwrite that day's file. The export covers every table, including `measurements` and the profile columns. | Uninstall, lost phone |
| **Android Auto Backup** | Android copies the app's data to the trainer's Google account automatically, about once a day, when the phone is idle, charging and on Wi-Fi. Turned on in the app config, with the database file included. | Lost phone, new phone |
| **Warning** | If no backup folder is chosen, or the last automatic export failed, the Clients screen shows a warning until it is fixed. | A silent backup failure |

**Restore:** Settings has "Restore from backup", which reads a JSON export and replaces all data (every table in section 6) after a confirmation ("This replaces all data in the app"). A restore test on a reinstalled app is part of the MVP's "done when" check.

### `app/`: screens

- **Clients:** list, add, edit, archive. Adding a client needs only a first name. A client is shown by first name and last name.
  - **"Me"** is created on first start with first name "Me", and is marked with `is_self = 1`. The trainer can rename it. It cannot be archived.
- **Client:** that client's profile, history, recovery and progress.
  - **Profile:** first name (required), last name, gender (Female, Male, Other, Prefer not to say), date of birth (the screen shows the age), height in cm, and body weight in kg. Body weight is a dated history: adding a weight saves it with a date (today by default), and the profile shows the latest one and the list of earlier ones. A weight entry can be edited or deleted. A client has at most one weight per date: adding a second one for the same date asks "Replace the weight for this date?".
- **Session:** the flow from section 4.
- **Settings:** CSV import, JSON export, backup folder, restore from backup.

There is no global state library. The database is the source of truth, and screens read from it through reactive queries (Drizzle's `useLiveQuery`). A screen updates by itself after any write, so it never shows stale data. The app has no network code.

### Language

The MVP UI is in English. Exercise names show the English and Polish names. A full Polish UI is a backlog item.

### Errors

- Blank weight or reps is allowed and saved as NULL.
- Number fields accept a comma or a dot as the decimal separator (`22,5` and `22.5` are both 22.5 kg). Reps accept whole numbers only.
- Invalid input (negative numbers, text in number fields) is blocked in the input field.
- A failed import reports the failing row and imports nothing.

## 6. Data model

```
clients ──< sessions ──< session_exercises ──< sets
   └──< measurements
                               │
exercises ─────────────────────┘
   └──< exercise_muscles
```

| Table | Columns |
|---|---|
| `clients` | `id`, `first_name`, `last_name`, `gender`, `date_of_birth`, `height_cm`, `is_self`, `notes`, `created_at`, `updated_at`, `archived_at` |
| `measurements` | `id`, `client_id`, `date`, `type`, `value`, `created_at`, `updated_at` |
| `exercises` | `id`, `name_en`, `name_pl`, `category`, `training_type`, `pattern`, `is_custom`, `created_at`, `updated_at` |
| `exercise_muscles` | `exercise_id`, `muscle` |
| `sessions` | `id`, `client_id`, `date`, `status` (`draft` or `finished`), `started_at`, `finished_at`, `updated_at` |
| `session_exercises` | `id`, `session_id`, `exercise_id`, `position`, `finished_at`, `updated_at` |
| `sets` | `id`, `session_exercise_id`, `set_no`, `weight_kg`, `reps`, `side`, `height_cm`, `speed_kmh`, `minutes`, `note`, `created_at`, `updated_at` |

- **IDs are UUIDs,** so a future server can sync records from several devices without ID collisions.
- **Every table has timestamps.** A future sync uses `updated_at`.
- **Nullable columns:** `weight_kg` and `reps` can be NULL. `side`, `height_cm`, `speed_kmh`, `minutes` and `note` are nullable and have no UI in the MVP. They keep the imported history complete. Backlog items 4 and 5 add their UI.
- **Archiving:** archiving a client hides the client and keeps their history.
- **Profile fields:** only `first_name` is required. `clients.height_cm` is the client's height; `sets.height_cm` is a box height and is unrelated. `gender` is one of `female`, `male`, `other`, `prefer_not_to_say`, or NULL. `date_of_birth` is stored instead of an age, so the age stays correct.
- **"Me":** exactly one client has `is_self = 1`.
- **Measurements:** unique on (`client_id`, `type`, `date`). In the MVP `type` is always `weight` and `value` is in kg. Backlog item 14 adds new types (in cm) without a new table.
- **Units:** weights in kg, heights and lengths in cm. There is no unit setting.
- **Finished session:** a finished session counts as a gym visit. There is no separate visits table.
- **Computed values:** recovery and progress are computed from sets and never stored.

### Import of the existing history

- Every imported row goes to client "Me", the client with `is_self = 1`, whatever its name.
- Rows are grouped by date into finished sessions.
- Exercises are matched by `name_en`.
- Set numbers and every column are kept.
- An unknown exercise name stops the import and lists the unknown names. Nothing is imported partly.

The personal CSV files (`legacy/data/*.csv`) are not committed to git. The user picks them from the phone at import time. Tests use a small anonymised sample.

## 7. CI/CD

### `ci.yml`

Runs on every pull request to `main`, after every merge, and when called by another workflow (`workflow_call`).

| Step | Tool |
|---|---|
| Install | `npm ci` with cache |
| PR title check | commitlint, on pull requests only |
| Lint | ESLint and Prettier check |
| Type-check | `tsc --noEmit` |
| Unit tests | Jest with a coverage report |
| Expo check | `npx expo-doctor` |

All steps are required status checks on `main`.

### `build-android.yml`

- **Trigger:** manual only (`workflow_dispatch`).
- **Input:** `profile`, either `preview` (APK) or `production` (AAB).
- **Job 1:** calls `ci.yml`.
- **Job 2:** needs job 1. It runs `eas build --platform android --profile <profile> --non-interactive --no-wait`. It authenticates with `expo/expo-github-action` and the `EXPO_TOKEN` GitHub secret.
- **Output:** the build appears on the expo.dev dashboard with an install link and QR code.
- **Versions:** EAS increases `versionCode` automatically. The user sets the visible version.
- **Signing:** the keystore is created once with `eas credentials` and stored by EAS. Play App Signing is turned on in Stage 4.

### Repository settings

- `main` is protected: pull request required, required checks must pass, no force push.
- Squash merge only. Branches are deleted after merge.
- Dependabot opens weekly update PRs.
- The only secret is `EXPO_TOKEN`. `.env` files are ignored by git.

### Commit and branch convention

- **Squash commit (the PR title):** `<type>(<scope>): GYM-<n> <ticket name>`, for example `feat(log): GYM-12 Log set screen`.
- **Types:** `feat`, `fix`, `ci`, `build`, `test`, `refactor`, `docs`, `chore`, `perf`.
- **Scopes:** `log`, `clients`, `exercises`, `recovery`, `progress`, `db`, `import`, `design`, `infra`.
- **Branch:** `<type>/GYM-<n>-short-name`, for example `feat/GYM-12-log-set-screen`.

## 8. Workflow: Jira, GitHub and Claude

### Jira

- **Epic** = stage.
- **Story or Task** = one pull request and one squash commit.
- **Sub-tasks** record how Claude split the ticket.
- **Statuses:** To Do, In Progress, In Review, Done.
- **Sprints** last 2 weeks. Claude proposes the content. The user starts and closes sprints.

### Roles

- **User:** product owner. Sets priorities, approves product, design, architecture and business decisions, approves PRs that need owner approval, runs the build workflow, tests on the phone. The user does not review code.
- **Claude:** developer. Writes and splits tickets, codes, tests, opens PRs, updates Jira, and merges PRs once they pass review.
- **Review subagent:** a fresh Claude subagent that reviews each PR's code and has not seen the implementation work. It posts its review as a PR comment, either approving or requesting changes.

### Owner approval

Before merging, Claude asks the user to approve any PR that:

- changes the spec, `CLAUDE.md` or a product decision;
- changes the database schema or the folder layers, or adds a new library;
- changes a screen or flow away from the approved Penpot design;
- changes CI/CD, repo settings or infrastructure.

Claude adds the GitHub label `needs-owner`, explains the decision in plain language in the PR description, and waits for the user's approval in chat or on the PR. Claude merges every other PR once the review subagent approves and CI is green.

### Claude's loop for each ticket

1. Read the ticket through the Jira MCP. Ask the user about anything unclear.
2. Post the plan as a Jira comment and create the sub-tasks.
3. Move the ticket to In Progress and create the branch.
4. Write tests first, then code. Commit on the branch.
5. Open the PR through the GitHub MCP. The description:
   - links the ticket;
   - lists the changes and how they were tested;
   - ends with "Agent notes": the plan, what went wrong, and what the tests caught.
6. When CI is green, move the ticket to In Review and run the review subagent on the PR.
   - If it requests changes, move the ticket back to In Progress, fix them, and run the review again.
   - If it approves, and the PR needs owner approval, wait for the user.
   - Then squash-merge.
7. Move the ticket to Done. Comment with anything deferred, and create backlog tickets for the deferred work.

### Definition of Done

- CI is green.
- New logic has tests.
- The review subagent has approved the PR, and so has the user if it needs owner approval.
- The PR is merged.
- The Penpot design was followed, where the ticket has one.
- Jira is up to date.

### Integrations

- Atlassian remote MCP, GitHub MCP and Penpot MCP.
- The GitHub for Jira app, which shows branches, commits, PRs and builds on each ticket.

### Agent limits

- Claude never pushes to `main` directly.
- Claude merges only through a PR with green CI and an approving subagent review, plus the user's approval when the PR needs it.
- Claude never bypasses branch protection.
- Claude never handles secrets and never creates accounts.
- The user creates the GitHub, Jira, Expo, Penpot and Google Play accounts, and authorises each MCP connection.

## 9. Testing

- **Unit tests (Jest)** for all of `domain/`. Expected values come from the output of `gym_tracker.py` on the same sample data.
- **Data tests** against an in-memory SQLite database: migrations, seed, import, export, restore, session drafts, the one-draft rule.
- **Component tests** for the log-session flow.
- **End-to-end UI tests** are a backlog item (Maestro).
