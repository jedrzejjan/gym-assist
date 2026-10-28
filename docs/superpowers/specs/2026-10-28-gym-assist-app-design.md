# Gym Assist app: design

Date: 2026-10-28
Status: draft, waiting for review

## 1. Purpose

Gym Assist is an Android app for a personal trainer to log training sessions and track progress, for their clients and for themselves. The trainer is the only user. Each client, including the trainer, is a profile in the app.

The project has three aims:

1. **Build the app.** First as an APK on the trainer's own phone, later on the Play Store.
2. **Run it like a business.** Jira for stages and tickets, GitHub with CI/CD, MCP connections to external tools, and a product that could one day be sold.
3. **Learn how an AI coding agent works.** Claude codes every ticket. The user acts as product owner and reviewer. Jira records how Claude splits work into smaller tasks.

### Success criteria

- The trainer runs a real session with the app and needs no CSV file or Python script.
- Every stage and ticket, and the split of tickets into sub-tasks, is visible in Jira.
- Every change reaches `main` through a pull request with green CI, reviewed and merged by the user.

### Out of scope

- Rehabilitation logic. The app tracks training and progress. It is not a rehab app.
- AWS. This project does not use AWS.
- Client logins, iOS builds and a server in the MVP.

## 2. Decisions

| Topic | Decision |
|---|---|
| Users | One trainer account, no login. Clients are profiles. The trainer is the first profile ("Me"). |
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

- **Sprint 1:** local database and migrations, exercise library with seed data, clients, log session. Result: a real session can be logged on the phone.
- **Sprint 2:** history, recovery, progress, CSV import of the existing history, JSON export. Result: the app replaces the Python tool.

**Done when:**

- the APK is installed on the user's phone;
- the user has logged three real sessions with it;
- the recovery screen matches `python legacy/gym_tracker.py status` for the same data;
- CI is green.

### Stage 3: Backlog after the MVP

The order can change when the user reprioritises, but Terraform stays first. In priority order:

1. **Terraform for the GitHub repo.** Bring the existing repo, branch protection, labels and security settings under Terraform with `terraform import`. Use the `integrations/github` provider. Keep the state outside git (HCP Terraform free tier, or local state with backups; check the current limits at setup). Keep `EXPO_TOKEN` out of Terraform. Infra PRs run `terraform fmt -check`, `validate` and `plan`. The user runs `apply` by hand.
2. **Add exercise page.** Lets the trainer create a custom exercise (`is_custom = 1`) with names, category, training type, pattern and muscles.
3. **Extra set properties per exercise.** UI for box height, cardio speed and minutes, and set notes. The columns already exist (section 6).
4. **Left and right side (L/P) for sets.** The UI for the `side` column.
5. **Choose and add a server.** For backup beyond the phone, sync across devices, and client logins. Candidates: Supabase, Firebase, AWS, Cloudflare Workers + D1, Google Cloud Run.
6. Progress curve charts.
7. "What should I train today?" suggestion.
8. End-to-end UI tests with Maestro.
9. CI extras: EAS Submit to the Play Store, EAS Update (over-the-air updates), release notes generated from commit types.
10. Full Polish translation of the UI.

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
4. **Add a set:** weight and reps. Both may be left blank.
5. **Keep adding sets.** "Finish exercise" is available after any number of sets.
6. **Back on the choose-exercise page**, the trainer chooses the next exercise as in step 3. This page also shows:
   - **Finish session:** saves the session as finished.
   - **Cancel session:** asks "Discard this session?" and, if confirmed, deletes the draft.

The session is saved as a draft after every set. If the app closes or the phone dies, the trainer continues the draft where they left off.

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

- `recovery.ts` turns the last date a pattern or muscle was trained into a status. The thresholds are the same as `recovery_label` in the Python tool:
  - fewer than 2 days: "recovering, too soon";
  - 2 to 3 days: "in supercompensation window (48–72 h)";
  - more than 3 days: "due";
  - never trained: "never logged".
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
- **Export:** JSON export of all data, as a manual backup.

### `app/`: screens

- **Clients:** list, add, edit, archive.
- **Client:** that client's history, recovery and progress.
- **Session:** the flow from section 4.
- **Settings:** import and export.

There is no global state library. The database is the source of truth, and screens read from it. The app has no network code.

### Language

The MVP UI is in English. Exercise names show the English and Polish names. A full Polish UI is a backlog item.

### Errors

- Blank weight or reps is allowed and saved as NULL.
- Invalid input (negative numbers, text in number fields) is blocked in the input field.
- A failed import reports the failing row and imports nothing.

## 6. Data model

```
clients ──< sessions ──< session_exercises ──< sets
                               │
exercises ─────────────────────┘
   └──< exercise_muscles
```

| Table | Columns |
|---|---|
| `clients` | `id`, `name`, `notes`, `created_at`, `updated_at`, `archived_at` |
| `exercises` | `id`, `name_en`, `name_pl`, `category`, `training_type`, `pattern`, `is_custom`, `created_at`, `updated_at` |
| `exercise_muscles` | `exercise_id`, `muscle` |
| `sessions` | `id`, `client_id`, `date`, `status` (`draft` or `finished`), `started_at`, `finished_at`, `updated_at` |
| `session_exercises` | `id`, `session_id`, `exercise_id`, `position`, `finished_at`, `updated_at` |
| `sets` | `id`, `session_exercise_id`, `set_no`, `weight_kg`, `reps`, `side`, `height_cm`, `speed_kmh`, `minutes`, `note`, `created_at`, `updated_at` |

- **IDs are UUIDs,** so a future server can sync records from several devices without ID collisions.
- **Every table has timestamps.** A future sync uses `updated_at`.
- **Nullable columns:** `weight_kg` and `reps` can be NULL. `side`, `height_cm`, `speed_kmh`, `minutes` and `note` are nullable and have no UI in the MVP. They keep the imported history complete. Backlog items 3 and 4 add their UI.
- **Archiving:** archiving a client hides the client and keeps their history.
- **Finished session:** a finished session counts as a gym visit. There is no separate visits table.
- **Computed values:** recovery and progress are computed from sets and never stored.

### Import of the existing history

- Every imported row goes to client "Me".
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

- **User:** product owner and reviewer. Sets priorities, approves designs, reviews and merges PRs, runs the build workflow, tests on the phone.
- **Claude:** developer. Writes and splits tickets, codes, tests, opens PRs, updates Jira.

### Claude's loop for each ticket

1. Read the ticket through the Jira MCP. Ask the user about anything unclear.
2. Post the plan as a Jira comment and create the sub-tasks.
3. Move the ticket to In Progress and create the branch.
4. Write tests first, then code. Commit on the branch.
5. Open the PR through the GitHub MCP. The description:
   - links the ticket;
   - lists the changes and how they were tested;
   - ends with "Agent notes": the plan, what went wrong, and what the tests caught.
6. When CI is green, move the ticket to In Review. The user reviews and merges.
7. Move the ticket to Done. Comment with anything deferred, and create backlog tickets for the deferred work.

### Definition of Done

- CI is green.
- New logic has tests.
- The user has reviewed and merged the PR.
- The Penpot design was followed, where the ticket has one.
- Jira is up to date.

### Integrations

- Atlassian remote MCP, GitHub MCP and Penpot MCP.
- The GitHub for Jira app, which shows branches, commits, PRs and builds on each ticket.

### Agent limits

- Claude never pushes to `main` and never merges.
- Claude never handles secrets and never creates accounts.
- The user creates the GitHub, Jira, Expo, Penpot and Google Play accounts, and authorises each MCP connection.

## 9. Testing

- **Unit tests (Jest)** for all of `domain/`. Expected values come from the output of `gym_tracker.py` on the same sample data.
- **Data tests** against an in-memory SQLite database: migrations, seed, import, export, session drafts.
- **Component tests** for the log-session flow.
- **End-to-end UI tests** are a backlog item (Maestro).
