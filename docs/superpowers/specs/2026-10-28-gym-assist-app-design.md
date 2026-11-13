# Gym Assist app: design

Date: 2026-10-28
Status: approved 2026-10-28, updated 2026-11-11 (Stage 1 kickoff decisions; GYM-63 draft return; GYM-68 1RM, % weight, body weight exercises, progress categories; GYM-70 Home screen, optional "Me", exercise library, Add exercise in the MVP; GYM-71 Stage 1 screen details; GYM-75 wording tidy-up; GYM-16 `app_settings`, `useLive`; GYM-99 exercise category hidden, 2026-11-13)

## 1. Purpose

Gym Assist is an Android app for a personal trainer to log training sessions and track progress, for their clients and for themselves. The trainer is the only user. Each client is a profile in the app, and the trainer can add their own profile ("Me") if they want to track themselves.

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
| Users | One trainer account, no login. Clients are profiles. The trainer can also have their own profile ("Me"); it is optional. |
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
2. Wireframes, discussed screen by screen.
3. A clickable prototype of the log-session flow.

Done when the user approves the designs. Each MVP ticket links to its Penpot board.

### Stage 2: MVP on the phone

Two 2-week sprints:

- **Sprint 1:** local database and migrations, exercise library with seed data, Welcome, Home, the Exercise library screens and Add exercise, clients with their profile, log session. Result: a real session can be logged on the phone.
- **Sprint 2:** history (including editing and deleting a finished session), recovery, progress, CSV import of the existing history, and the backup plan in section 5: JSON export, automatic backups, restore. Result: the app replaces the Python tool.

**Done when:**

- the APK is installed on the user's phone;
- the user has logged three real sessions with it;
- the recovery screen matches `python legacy/gym_tracker.py status` for the same data (on the owner's install, with their history imported into "Me");
- a backup restores correctly on a reinstalled app;
- CI is green.

### Stage 3: Backlog after the MVP

The order can change when the user reprioritises, but Terraform stays first. In priority order:

1. **Terraform for the GitHub repo.** Bring the existing repo, branch protection, labels and security settings under Terraform with `terraform import`. Use the `integrations/github` provider. Keep the state outside git (HCP Terraform free tier, or local state with backups; check the current limits at setup). Keep `EXPO_TOKEN` out of Terraform. Infra PRs run `terraform fmt -check`, `validate` and `plan`. The user runs `apply` by hand.
2. **Plan a session in advance and run it live** (GYM-55, High). Before meeting a client, the trainer prepares the session: exercises and target sets. During the meeting they follow the plan and log it, and can change anything on the fly: swap an exercise or its variation, change weight or reps, add or remove exercises. It reuses the log-session screens. One possible model (to be designed, not decided): a planned session is a session with targets filled in ahead of time; a `planned` status would also need a rule next to the one-draft rule.
3. **Add exercise page.** Moved to the MVP on 2026-11-10 (GYM-70, Jira GYM-29); see section 5, Exercise library. Editing and deleting custom exercises stay here.
4. **Extra set properties per exercise.** UI for box height, cardio speed and minutes, and set notes. The columns already exist (section 6).
5. **Left and right side (L/P) for sets.** The UI for the `side` column.
6. **Choose and add a server.** For backup beyond the phone, sync across devices, and client logins. Candidates: Supabase, Firebase, AWS, Cloudflare Workers + D1, Google Cloud Run.
7. Progress curve charts.
8. "What should I train today?" suggestion.
9. End-to-end UI tests with Maestro.
10. CI extras: EAS Submit to the Play Store, EAS Update (over-the-air updates), release notes generated from commit types.
11. Full Polish translation of the UI.
12. **One-month training plan** (GYM-56). A month of planned sessions for a client, built on item 2.
13. **Extend the client profile with an intake questionnaire** (GYM-57). The user prepares the questions. It may hold health information, so it needs the GDPR basics (item 20) first.
14. **Body measurements** (GYM-58): waist, biceps, legs and more, as new types in the `measurements` table (section 6). They show in the Body category of Progress.
15. **Motor ability of an exercise** (GYM-67, PL "zdolność motoryczna"): assess which ability the sets train (maximal strength, maximal power, functional strength, hypertrophy, strength endurance, power endurance) from reps, % of 1RM, sets, tempo and rest. The user's reference table is in GYM-67.
16. **Knowledge materials on Home** (GYM-69): informative materials for trainers, reached from the Home screen. The first one is the motor ability parameters table from GYM-67.
17. **Reorder exercises by press-and-hold and drag** (GYM-66). Replaces the up and down buttons on the reorder page with a drag handle.

The items below came from a review of this spec, not from the user. In Jira they get the label `ai-generated`. Items 19 to 23 also get priority Low.

18. **Test and CI hygiene** `[AI generated]`
    - Run the data tests on `better-sqlite3` through Drizzle, because `expo-sqlite` does not run in Jest. Write down that Node's SQLite can behave slightly differently from the phone's.
    - Add a migration test that upgrades a database with realistic data from schema version N to N+1.
    - Set a coverage threshold of about 90% for `domain/` only.
    - Make Dependabot ignore Expo-managed packages, and upgrade those with `npx expo install --fix`.
19. **Soft deletes for sync** `[AI generated, Low]`. Part of the server work in item 6. Add `deleted_at` or a tombstone table, designed for the chosen server. Until sync exists, deletes stay hard deletes, because there is no other device to tell.
20. **App lock and GDPR basics** `[AI generated, Low]`
    - PIN or fingerprint lock with `expo-local-authentication`.
    - A privacy notice and a client consent note.
    - Export and delete of all data for one client.
    Recommended before the first real client's data goes into the app.
21. **EAS build status in GitHub** `[AI generated, Low]`. With `--no-wait`, a failed EAS build still shows green in GitHub. For now the failure shows on expo.dev and by email. This item reports the result back to GitHub, by polling `eas build:view` or through an Expo webhook.
22. **Architecture Decision Records** `[AI generated, Low]`. Short records in `docs/adr/` of the key decisions: Expo over Kotlin, local-first, no AWS, Penpot, Terraform timing. The user writes the "no AWS" reason.
23. **Expo SDK upgrade routine** `[AI generated, Low]`. A recurring chore for each new Expo SDK release: upgrade, run `npx expo install --fix`, run the tests, check on the phone.

### Stage 4: Play Store

- Google Play developer account (one-time fee, paid by the user).
- Privacy policy and GDPR basics. Client data can include health information.
- `production` build as an AAB, with Play App Signing.
- Internal testing track, then a closed test with the number of testers Google requires (currently about 12), then production.
- Monetisation options are decided at this stage.

## 4. Log-session flow

1. **Choose a client:** Home → Clients → a client → History tab → "Start session". "Me", if it exists, is a normal client here.
2. **Start a session.** The date is today by default and can be changed.
3. **Choose an exercise** in one of two ways:
   - by movement pattern, then an exercise from that pattern;
   - from the full exercise list, with search.
   A third way, "New exercise", opens the Add exercise page (section 5, Exercise library). After saving, the new exercise is chosen for the session.
   When an exercise is chosen, the screen shows that client's sets from the last session that had this exercise, for example "Last time: 60 kg × 8, 60 kg × 8, 62.5 kg × 6", or "Last time: BW + 10 kg × 6, BW × 8" for an exercise that uses body weight. If there is none, it shows "First time".
4. **Add a set:** weight and reps. Both may be left blank.
   - **Weight in kg or %:** a "kg | %" switch next to the weight field lets the trainer type the weight in kg or as a % of the client's 1RM for this exercise (section 5, `progress.ts`). It starts on kg and keeps the last choice for the rest of that exercise in the session. A % is turned into kg (section 5, "% to kg") and the set is saved in kg only; the % is not stored, so editing the set shows kg. The % option is available only when the client has a 1RM for the exercise; otherwise the screen says "Set a 1RM in Progress to use %".
   - **Exercises that use body weight** (for example pull-ups): the weight typed is the added load, and the set shows as "BW + 10 kg". A blank weight means no added load and shows as "BW", as in the Python tool. The load used for e1RM and % is the client's body weight on the session date plus the added load. The body weight on a date is the latest entry on or before it; for sessions before the first entry, the earliest entry is used. Every client has a body weight (section 5, Profile).
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

**Getting back to a draft.** While a draft exists, the Home screen shows a "Session in progress" bar with the client's first and last name.
- The bar sits at the bottom of the Home screen, within thumb reach. The backup warning (section 5) sits at the top, so both can show at once.
- Tapping the bar opens the draft where the trainer left off: the add-set page if an exercise is still open (not finished), otherwise the choose-exercise page.
- Opening the app shows the Home screen as usual (Welcome on the very first start); it does not jump into the draft.

**Finishing needs an exercise.** "Finish session" is available once the session has at least one exercise. A session with no exercises can only be cancelled.

**Editing a finished session.** From a client's history, a finished session opens as a read-only summary with two buttons: "Edit" and "Delete session". After "Edit", the trainer changes it with the same screens: its date, its exercises and their order, and its sets.
- Every change is saved at once, as in a draft. There is no separate Save step.
- The same screens in edit mode (GYM-102, owner decision 2026-11-12): the session page reads "Edit session", with a Date field (today or earlier), numbered rows without the ✓ mark, "+ By pattern", "+ Full list", "+ New exercise", Reorder and the note "Changes are saved at once. The session stays finished."; its button is "Done", with no "Finish session" or "Cancel session". On the exercise page, "Done" replaces "Finish exercise", and a set change doesn't reopen the exercise.
- "Last time" on a session being edited shows the client's latest finished session before it (by date, then finish time), never the session itself or a later one.
- The session stays finished and does not count as a draft, so it can be edited while a draft is open elsewhere.
- Removing the last exercise asks "Delete this session?" instead ("<exercise> is its only exercise. A finished session needs at least one."), because a finished session must have at least one exercise. Delete removes the session and returns to History.
- "Delete session" asks "Delete this session? This cannot be undone."
- Recovery and progress update by themselves, because they are computed from sets. The stored 1RM does not change (section 5).

**One draft at a time.** Only one draft session can be open in the whole app. If the trainer starts a session while a draft exists, for the same client or another one, the app asks "A session is already in progress", with "Resume", "Finish it" or "Discard it". For a draft with no exercises, it offers only "Resume" and "Discard it". Discard uses the same "Discard this session?" confirmation.

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
  An exercise counts once it has at least one set. The Recovery tab (GYM-23) shows Patterns or Muscles: the patterns in the order above without "none" (such an exercise still counts for its muscles), then the 12 muscles in catalogue order. Each row reads "<status> · N days ago" ("today" for 0 days, "1 day ago" for 1), or "never logged".
- `progress.ts` holds the Epley estimated one-rep max (`weight` when reps = 1, otherwise `weight × (1 + reps / 30)`) and the best set per exercise. The best set is ranked by e1RM, then reps. Sets without weight or reps are not compared. For an exercise that uses body weight, `weight` is the total load (body weight on the session date + added load, with a blank added load counted as 0). This is an intended difference from the Python tool, which ranks such sets by the added load only, so parity checks against `gym_tracker.py` cover the other exercises.
  - **1RM per client and exercise** is a stored value, not a live calculation. It changes only when the trainer sets it on purpose in Progress, one exercise at a time: "Estimate from history" (the best e1RM from finished sessions; a confirmation shows the value and the set it comes from, e.g. "101.75 kg, from 92.5 kg × 3 on 5 Nov") or "Set manually". Logging a session never changes it. Its date is the date it was set.
  - **% to kg:** `kg = 1RM × % / 100`, rounded to the nearest 1 kg (fine enough for small muscle groups such as biceps). For an exercise that uses body weight, the added load is that total minus the body weight on the session date, rounded to the nearest 1 kg and never below 0.
- `sets.ts` gives the next set number in a session exercise and the display format, where a blank value shows as "-".
- `catalogue.ts` holds the fixed lists:
  - categories: KD, HD, Push, Pull, Core. Stored but not shown (GYM-99); a custom exercise gets its category from its pattern (KD and HD stay, Push… gives Push, Pull… gives Pull, the rest give Core);
  - training types: Strength, Plyometric, Power, Cardio;
  - movement patterns: KD, HD, Push vertical, Push horizontal, Pull vertical, Pull horizontal, Anti flexion, Anti extension, Carries, none. The screens show KD as "Knee Dominant" and HD as "Hip Dominant";
  - the 12 muscles with English and Polish names.

All domain functions are pure: data in, result out.

### `data/`

- SQLite on the phone through `expo-sqlite`, with Drizzle ORM for typed queries and versioned migrations. A migration must upgrade existing data without loss.
- **Seed:** the exercise library from `exercises.csv`, loaded on first start before Welcome shows, so the library is never empty.
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
| **Automatic export after every change to finished data** | After "Finish session", and after any other write except a change to a draft (for example editing or deleting a finished session, adding, editing or archiving a client, a weight entry, setting a 1RM, or a CSV import), the app writes a full JSON export to a folder the trainer picks once, through Android's folder picker. The folder can be a Google Drive folder. The file name is `gym-assist-backup-YYYY-MM-DD.json`, and the app keeps the last 10 files. Several changes on the same day overwrite that day's file. The export covers every table, including `measurements`, `one_rep_maxes`, the profile columns and `exercises.uses_bodyweight`. | Uninstall, lost phone |
| **Android Auto Backup** | Android copies the app's data to the trainer's Google account automatically, about once a day, when the phone is idle, charging and on Wi-Fi. Turned on in the app config, with the database file included. | Lost phone, new phone |
| **Warning** | If no backup folder is chosen, or the last automatic export failed, the Home screen shows a warning at the top until it is fixed: "Backups are off: choose a folder" when no folder is chosen, or "Last backup failed: check the folder" when the last export failed, with a "Fix" action that opens Settings. | A silent backup failure |

**Restore:** Settings has "Restore from backup", which reads a JSON export and replaces all data (every table in section 6) after a confirmation ("This replaces all data in the app"). When it finishes, the app shows "Restore done" with the backup's date and how many clients and sessions it brought back, and a "Go to clients" button. A restore test on a reinstalled app is part of the MVP's "done when" check.

### `app/`: screens

- **Welcome** (first start only): "Create my profile" or "Skip for now". "Create my profile" asks for the trainer's first name and body weight (the rest is optional, as for any client) and creates "Me". "Skip for now" goes straight to Home; then there is no "Me" and the client list starts empty. If the app is closed before a choice, Welcome shows again next time.
- **Home** (the start screen): three tiles, in this order: Clients, Settings, Exercise library. There is no placeholder for future items. While a draft exists, a "Session in progress" bar resumes it (section 4); the backup warning shows here too. Knowledge materials join Home later (backlog item 16).
- **Clients:** list, add, edit, archive. Adding a client needs a first name and a body weight; everything else is optional. A client is shown by first name and last name.
  - The trainer's own profile is pinned first and marked "me".
  - While there is no "Me", an "Add my profile" row sits at the top of the list.
  - An empty list says "No clients yet" above the "Add client" button.
  - **"Me"** is optional: the trainer's own profile, marked with `is_self = 1`. It is created from Welcome, or later with "Add my profile" on Clients while there is none (only there, not in Settings). The trainer can rename it. It cannot be archived.
- **Exercise library:** the exercises installed with the app (the seed list), browsed by pattern or with search. Tapping one shows its English and Polish names, training type, pattern, muscles and whether it uses body weight. The seed exercises are read-only.
  - **Add exercise:** from the library (and "New exercise" in the log-session flow), the trainer creates a custom exercise (`is_custom = 1`). Required: English name, training type and pattern ("none" is allowed; such an exercise does not count in pattern recovery). Optional: Polish name, muscles. A switch says whether it uses body weight (for example dips). The English name must be unique (section 6); a duplicate shows "An exercise with this name already exists". The library grows with use.
  - Editing and deleting custom exercises are not in the MVP (backlog item 3).
- **Client:** that client's profile, history, recovery and progress, as tabs (Profile | History | Recovery | Progress). Tabs replace each other, so back from any tab returns to Clients. "Start session" is at the bottom of the History tab, and the profile's body-weight link reads "Weight history ›" (GYM-22, owner decisions 2026-11-12).
  - **Progress** has two categories. **Strength** (the main one): per exercise, the current 1RM with its date and source (estimated or manual), the "Estimate from history" and "Set manually" buttons, and the best set. **Body**: the body weight history. More measurements join this category with backlog item 14.
  - **Profile:** first name (required), body weight (required), last name, gender (Female, Male, Other, Prefer not to say), date of birth (the screen shows the age), height in cm. Body weight (kg) is a dated history: adding a weight saves it with a date (today by default), and the profile shows the latest one and the list of earlier ones. A weight entry can be edited or deleted, except that the last remaining entry can only be edited, because every client must have a body weight. A client has at most one weight per date: adding a second one for the same date, or moving an entry to a date that already has one, asks "Replace the weight for this date?". Deleting an entry asks "Delete this weight entry?" and shows its weight and date.
- **Session:** the flow from section 4.
- **Settings:** CSV import (optional, for the trainer's own history), JSON export, backup folder, restore from backup.

There is no global state library. The database is the source of truth, and screens read from it through `useLive` in `data/live.ts`, which re-runs after every write made through `data/` (`mutate`). A screen updates by itself after any write, so it never shows stale data. (Drizzle's own `useLiveQuery` only runs on the phone's database, so it could not be tested in Jest.) The app has no network code.

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
   ├──< measurements
   └──< one_rep_maxes >── exercises
                               │
exercises ─────────────────────┘
   └──< exercise_muscles
```

| Table | Columns |
|---|---|
| `clients` | `id`, `first_name`, `last_name`, `gender`, `date_of_birth`, `height_cm`, `is_self`, `notes`, `created_at`, `updated_at`, `archived_at` |
| `measurements` | `id`, `client_id`, `date`, `type`, `value`, `created_at`, `updated_at` |
| `exercises` | `id`, `name_en`, `name_pl`, `category`, `training_type`, `pattern`, `uses_bodyweight`, `is_custom`, `created_at`, `updated_at` |
| `one_rep_maxes` | `id`, `client_id`, `exercise_id`, `value_kg`, `source` (`estimated` or `manual`), `created_at`, `updated_at` |
| `exercise_muscles` | `exercise_id`, `muscle`, `updated_at` (key: `exercise_id` + `muscle`) |
| `sessions` | `id`, `client_id`, `date`, `status` (`draft` or `finished`), `started_at`, `finished_at`, `updated_at` |
| `session_exercises` | `id`, `session_id`, `exercise_id`, `position`, `finished_at`, `updated_at` |
| `sets` | `id`, `session_exercise_id`, `set_no`, `weight_kg`, `reps`, `side`, `height_cm`, `speed_kmh`, `minutes`, `note`, `created_at`, `updated_at` |
| `app_settings` | `key`, `value`, `updated_at`: app-wide settings, such as whether Welcome was answered (later the backup folder and the last export status) |

- **IDs are UUIDs,** so a future server can sync records from several devices without ID collisions. Two tables have a natural key instead: `exercise_muscles` (`exercise_id` + `muscle`) and `app_settings` (`key`).
- **Every table has timestamps.** A future sync uses `updated_at`.
- **Nullable columns:** `weight_kg` and `reps` can be NULL. `side`, `height_cm`, `speed_kmh`, `minutes` and `note` are nullable and have no UI in the MVP. They keep the imported history complete. Backlog items 4 and 5 add their UI.
- **Archiving:** archiving a client hides the client and keeps their history.
- **Profile fields:** `first_name` is required, and every client has at least one `measurements` row of type `weight` (added together with the client). The other profile columns are optional. `clients.height_cm` is the client's height; `sets.height_cm` is a box height and is unrelated. `gender` is one of `female`, `male`, `other`, `prefer_not_to_say`, or NULL. `date_of_birth` is stored instead of an age, so the age stays correct.
- **"Me":** at most one client has `is_self = 1`.
- **Exercise category is hidden** (GYM-99, owner decision 2026-11-13): it mostly repeated the pattern, so no screen shows or asks for it. The `category` column stays, for later use (backlog: equipment categories such as Machine and Free weights).
- **Exercise names:** `exercises.name_en` is unique, ignoring upper and lower case ("Dips" and "dips" are the same), because the CSV import matches exercises by it. If a later seed update brings a name that already exists as a custom exercise, the seed entry is skipped and the custom one stays.
- **Measurements:** unique on (`client_id`, `type`, `date`). In the MVP `type` is always `weight` and `value` is in kg. Backlog item 14 adds new types (in cm) without a new table.
- **Units:** weights in kg, heights and lengths in cm. There is no unit setting.
- **Finished session:** a finished session counts as a gym visit. There is no separate visits table.
- **Computed values:** recovery and progress are computed from sets and never stored. The 1RM is the exception: it is stored, because it changes only when the trainer sets it.
- **1RM history:** each "Estimate from history" or "Set manually" adds a row to `one_rep_maxes`; the newest row (by `created_at`) per client and exercise is the current 1RM, and `created_at` is the date shown. Archiving a client keeps its 1RM rows, like its history.
- **Body weight exercises:** `exercises.uses_bodyweight` is 1 for "Underhand pull-up" and "Overhand pull-up" in the seed, 0 for the rest. For those exercises `sets.weight_kg` holds the added load.

### Import of the existing history

- The import is optional; other trainers never need it. Every imported row goes to client "Me", the client with `is_self = 1`, whatever its name. If there is no "Me", the import first asks the trainer to create their profile.
- Rows are grouped by date into finished sessions.
- Exercises are matched by `name_en`.
- Set numbers and every column are kept.
- For exercises that use body weight, the imported weight is treated as the added load, as in the Python tool.
- An unknown exercise name stops the import and lists the unknown names. Nothing is imported partly.
- When it succeeds, the app shows how many sessions it imported into "Me" (for example "52 sessions imported into Me.", using that profile's current name), and that they are in its History.

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
| Expo check | `npx expo-doctor@1.21.6` (pinned because 1.21.7 is broken, GYM-73) |

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
