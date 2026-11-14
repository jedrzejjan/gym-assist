# Stage 2, Sprint 2: Replace the Python Tool — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** By the end of this sprint, the app replaces `legacy/gym_tracker.py`. That means:
- the client screen gains History, Recovery and Progress tabs;
- finished sessions can be edited and deleted;
- the 1RM is stored;
- the trainer's CSV history can be imported;
- a JSON backup is written automatically and can be restored.

This is spec section 3, Sprint 2, plus the owner's phone-test findings from 2026-11-12 (GYM-99, and the GYM-22 scope note).

**Architecture:** No new layers and no new libraries.
- **Pure logic:** recovery, e1RM and best set, CSV parsing and validation, and the backup format go in `domain/`.
- **Database reads and writes:** go in `data/`, as functions that take `DbOrTx`. Screens call them inside `mutate`.
- **File access:** goes through one small adapter, `data/files.ts`, built on `expo-file-system`'s `Directory`/`File` API. Tests replace it with an in-memory fake.
- **Automatic export:** a listener on `mutate`. Every write triggers it unless the caller passes `{ export: false }`: draft-only writes, choosing the backup folder, the backup status save itself, and a restore. It also never exports a database with no clients, so a fresh install can't overwrite a real backup with an empty one. That makes the default fail safe: a forgotten flag gives one export too many, never one too few.

**Tech Stack:** unchanged from Sprint 1: Expo SDK 58, Expo Router, TypeScript, Drizzle ORM with expo-sqlite (better-sqlite3 in Jest), Jest with React Native Testing Library 14, expo-file-system ~58.0.13.

**Spec:** `docs/superpowers/specs/2026-10-28-gym-assist-app-design.md`. Read sections 4 ("Editing a finished session"), 5 (`recovery.ts`, `progress.ts`, Backup plan, Client, Settings), 6 (data model, Import) and 9.
**Designs:** `docs/design/README.md`, page **Other screens**. Each task names its boards. Read their text in Penpot at ticket start (the plugin tab must be awake).

## Global Constraints

Sprint 1's Global Constraints still apply (`docs/superpowers/plans/2026-11-11-stage-2-sprint-1.md`): layers, UUIDs and `updated_at`, kg and cm only, a blank value shown as `-`, number input, style tokens, no network code, and the per-ticket workflow. In addition:

- **Every screen action writes through one `mutate` call.** Repositories never call `mutate`, and never open a transaction. The one exception is the backup runner (`writeBackup`, `startAutoExport`), which is not a repository: it runs outside any screen action and saves its status with its own `mutate(…, { export: false })`.
- **Only finished sessions count** for history, recovery, progress, the 1RM estimate and "Last time". A draft never counts.
- **Calendar days:** `days = date difference in whole local days` between the session date and `todayLocal(new Date())`. These are not 24-hour periods.
- **Recovery statuses (exact):**
  - 0–1 days: "recovering, too soon";
  - 2–3 days: "in supercompensation window (48–72 h)";
  - 4 or more days: "due";
  - never: "never logged".
- **Epley:** `e1rm = weight` when reps = 1, otherwise `weight × (1 + reps / 30)`.
- **Backups:**
  - **File name:** `gym-assist-backup-YYYY-MM-DD.json`. It keeps the last 10 files, and several exports on one day overwrite that day's file.
  - **Format:** `{ "app": "gym-assist", "formatVersion": 1, "schemaVersion": <n>, "exportedAt": <ISO>, "tables": { <SQL table name>: [rows] } }`. `n` is the number of entries in `data/migrations/meta/_journal.json`. Rows are Drizzle's select objects (camelCase keys, e.g. `firstName`), so a restore inserts them back through Drizzle unchanged, in chunks of 100 rows to stay under SQLite's bound-variable limit.
  - **Settings keys** in `app_settings`: `backup.folderUri`, `backup.folderName`, `backup.lastAt`, `backup.lastError`.
  - **Dates shown from timestamps** (`exportedAt`, `created_at`) use the phone's local date: `todayLocal(new Date(iso))`, never the UTC date part of the string.
- **Exact strings.** Spec and boards; the boards win on wording the spec doesn't fix.
  - **Session:**
    - "Delete this session?";
    - "Delete this session? This cannot be undone.";
    - "Read-only. Tap Edit to change this session.";
    - "Changes are saved at once. The session stays finished.";
    - "No sessions yet. Start the first one below.".
  - **Progress:**
    - "No 1RM yet";
    - "Set the 1RM from history?";
    - "Set 1RM manually";
    - "Weight entry in % needs a 1RM for the exercise.".
  - **Backups:**
    - "Backups are off: choose a folder";
    - "Last backup failed: check the folder";
    - "Restore from backup?";
    - "This replaces all data in the app with <file>.";
    - "Restore done".
  - **Import:**
    - "Import complete";
    - "<N> sessions imported into <Me's name>.";
    - "Nothing was imported".
- **Owner approval:** tasks marked **needs-owner** change the schema, the spec, a flow away from its board, or the app config. They wait for the owner before merging.

## Owner decisions this plan asks for

These are approved with the plan PR. The spec, and `CLAUDE.md` where it is affected, are updated in the task named.

1. **Hide Category; keep the column** (Task 1, GYM-99). Changed by the owner on 2026-11-13, replacing "drop the column": no screen shows or asks for Category, and the database, seed and `CATEGORIES` stay for later use. A custom exercise gets its category from its pattern (`categoryForPattern`). No migration.
2. **The client screen gets the board's tab bar:** Profile | History | Recovery | Progress (Task 2). Tabs switch with `router.replace`, so back from any tab returns to Clients. "Start session" moves from the Profile tab to the bottom of the History tab, as on the `history/list` board. **Changed by the owner on 2026-11-14 (GYM-133), after the phone review:** "Start session" is back on Profile as its only footer button, History has none, and Edit profile, Weight history and Archive client moved into a kebab menu.
3. **Labels for the two histories** (Task 2, the owner's phone finding):
   - the History tab is the workout history;
   - the profile's body-weight link reads "Weight history ›" instead of "History ›", a small departure from the `client/profile` board. Since GYM-133 it is the "Weight history" item in the kebab menu.
4. **Editing a finished session** (Task 3):
   - it reuses the session page, the reorder page and the exercise page;
   - in a finished session, "Finish exercise" reads "Done", rows show no ✓, and a set change doesn't reopen the exercise;
   - the edit page keeps "+ New exercise", like the draft page, though the `history/session - editing` board doesn't show it;
   - "Last time" on an edited session shows the client's latest finished session *before* this one.
5. **Recovery** (Task 4):
   - an exercise counts once it has at least one set;
   - the rows follow the spec's pattern order (KD, HD, Push vertical, Push horizontal, Pull vertical, Pull horizontal, Anti flexion, Anti extension, Carries; "none" is left out), then the 12 muscles in catalogue order;
   - the subtitle is "<status> · N days ago" ("today" for 0 days, "1 day ago" for 1).
6. **Progress** (Task 5):
   - **Which exercises:** those the client did in finished sessions or that have a stored 1RM, most recently trained first.
   - **Estimated 1RM:** stored rounded to 2 decimals.
   - **Bodyweight exercises:** a manual 1RM is the total load. It shows as "1RM 81 kg total (BW + 17.5) · manual · 1 Nov 2026", using the latest body weight.
   - **Dates:** always shown as `D Mon YYYY`.
7. **Backup folder and Export** (Task 6):
   - "Export data (JSON)" writes today's file to the backup folder, and asks for a folder first if none is chosen. There is no share sheet, because that would mean a new library.
   - The folder comes from `Directory.pickDirectoryAsync()`, which already takes a persistable permission, so it survives a restart. Task 10 still checks this on the phone.
   - Overwriting today's file deletes it and creates it again. Android's document providers don't always truncate a file opened for writing, so writing over it could leave old bytes at the end.
   - **Google Drive:** the spec promises the folder "can be a Google Drive folder", but Android's folder picker may not offer Drive. Task 10 checks this. If Drive isn't offered, the owner chooses between a phone folder (Android Auto Backup still covers a lost phone) and a backlog ticket for Drive.
8. **Restore** (Task 9):
   - It replaces every table, except this phone's `backup.*` settings. A folder chosen on another phone can't be used on this one.
   - It accepts only a backup whose `schemaVersion` equals the app's. Restoring a backup from an older schema becomes a backlog ticket, needed before the next schema change after Task 1.
   - Before replacing anything, it writes the current data to `gym-assist-before-restore.json` in the backup folder. There is one such file, overwritten each time and not counted in the 10. Picking the wrong file by mistake can then be undone. It skips the safety file when no folder is chosen or the database has no clients (a fresh install has nothing to save). If the safety write fails, the restore stops and changes nothing. The restore never asks for a folder.
   - The restore itself doesn't trigger an automatic export, so it never overwrites today's backup.
9. **CSV import** (Task 8):
   - **Without a "Me":** it opens `create-profile` first, then continues the import (the open question on GYM-25). This changes spec section 5, which says "Me" is created "only there, not in Settings".
   - **Dates already in "Me":** it refuses a CSV that has a date on which "Me" already has a session, and lists those dates, so a second import can't duplicate history.
   - **`visits.csv`:** not imported. A visit with no sets has nothing to show.
10. **The backup warning** sits on Home, as the spec says (GYM-27's description says Clients; the spec wins).
11. **Android Auto Backup:** the Expo default already includes the database. Task 7 states it explicitly in `app.json` (`"allowBackup": true`) and pins it with a test. No backup-rules plugin is needed.
12. **New stories, split from oversized ones** (good scrum practice: one story, one reviewable PR):
    - "Edit a finished session", split from GYM-22;
    - "Restore from backup", split from GYM-26.

    Both are created under GYM-3 when this plan is approved. GYM-26 is renamed "JSON export and automatic export".

## Review Focus

1. **A finished session edited down to nothing.** Removing its last exercise must never leave an empty finished session. The data layer refuses it, and the screen offers "Delete this session?" instead. Pinned in Task 3 (`LastExerciseError`).
2. **The trainer's real CSV:**
   - 30 of its 72 rows have a `side` (`L`/`P`/`per side`), so the same date, exercise and `set_no` can appear twice;
   - 2 rows are cardio, with blank weight and reps but with speed and minutes;
   - a file saved by Excel may start with a UTF-8 BOM and use `\r\n`.

   All of it must import with every column kept. Pinned in Task 8 (`parseCsv`, `validateImport`), using an anonymised sample that has all of these.
3. **A failed or half-written backup.** The folder can disappear, or the permission can be revoked. The export must then record the failure and show the Home warning, and never throw into the screen that made the write. A restore from a malformed or newer-format file must change nothing. Pinned in Tasks 6, 7 and 9.
4. **Ties and gaps in the best set:**
   - sets with no weight or no reps are skipped;
   - a bodyweight set with blank added load counts as body weight only;
   - equal e1RMs go to more reps, then to the earliest date;
   - an exercise with no comparable set disables "Estimate".

   Pinned in Task 5.
5. **Changing the date of an edited session.** Moving a session onto another date reorders History, "Last time" and recovery straight away, and moving it into the future is refused. Pinned in Task 3 (`updateSessionDate`).

---

### Task 1: Hide Category in the app (GYM-99) — needs-owner

**Boards:** `library/detail`, `library/add exercise` (drop the Category row and the chips).

**Files:**
- Modify: `domain/catalogue.ts` (add `categoryForPattern(p: Pattern): Category`), `app/library/[id].tsx`, `app/library/add.tsx`
- Modify: the spec (sections 5 and 6) and the two Penpot boards
- Test: `domain/__tests__/catalogue.test.ts`, `tests/app/library.test.tsx`, `tests/app/add-exercise.test.tsx`, `tests/app/choose-exercise.test.tsx`

**Interfaces:**
- Produces: `categoryForPattern`; `NewExercise` keeps `category`, which Add exercise fills from the pattern.

- [ ] **Step 1: Write failing tests:** `categoryForPattern` for every pattern; the detail page has no "Category"; Add exercise saves with the name, training type and pattern alone and stores the derived category.
- [ ] **Step 2: Run them, expect FAIL.**
- [ ] **Step 3: Implement.** No schema change and no migration.
- [ ] **Step 4: Run the full suite.**
- [ ] **Step 5: Edit the spec and the boards.**
- [ ] **Step 6: Commit.** PR `feat(exercises): GYM-99 Hide Category in the app`, with `needs-owner` (spec and product decision).

### Task 2: Client tabs, workout history list, summary and delete (GYM-22)

**Boards:**
- `client/profile`, `client/profile - me`;
- `history/list`, `history/list - empty`;
- `history/session`;
- `history/dialog - delete session`.

**Files:**
- Create: `ui/TabBar.tsx` (the `kit/tab bar`: equal-width tabs, with the selected one underlined in the accent colour, `accessibilityRole="tab"` and `accessibilityState.selected`)
- Create: `ui/ClientTabs.tsx` (the four client tabs on top of `TabBar`; presentation only, routing stays in the screens)
- Create: `app/clients/[id]/history.tsx`, `app/session/[id]/summary.tsx`
- Create: `data/history.ts`
- Modify: `app/clients/[id]/index.tsx` (tab bar; "Start session" and its draft dialog move, code and all, to `history.tsx`; the label becomes "Weight history ›")
- Test: `data/__tests__/history.test.ts`, `tests/app/history.test.tsx`, `tests/app/profile.test.tsx`, `tests/app/session-flow.test.tsx` (where Start session lives)

**Interfaces:**
- Produces:
  - `type ClientTab = 'profile' | 'history' | 'recovery' | 'progress'` and `ClientTabs({ current, onSelect }: { current: ClientTab; onSelect: (t: ClientTab) => void })` in `ui/ClientTabs.tsx`. Each tab screen's `onSelect` calls `router.replace` to `/clients/${id}`, `/clients/${id}/history`, `/clients/${id}/recovery` or `/clients/${id}/progress`.
  - `listHistory(db, clientId): { sessionId: string; date: string; exerciseCount: number; setCount: number }[]`: finished only, newest date first, then `finished_at` desc.
  - `sessionSummary(db, sessionId): { date: string; clientId: string; status: 'draft' | 'finished'; exercises: { nameEn: string; namePl: string | null; usesBodyweight: boolean; sets: SetValue[] }[] } | null`: exercises by position, sets by `set_no`.
  - `deleteSession(db, sessionId): void`: finished only (throws on a draft). Sets, exercises and the session go in one go.

- [ ] **Step 1: Write failing data tests**
  - `'listHistory shows finished sessions newest first with exercise and set counts'`: two finished sessions and one draft give 2 rows, ordered by date desc, with `exerciseCount` and `setCount` right.
  - `'sessionSummary orders exercises by position and sets by set_no'`.
  - `'deleteSession removes the session, its exercises and sets, and refuses a draft'`.
- [ ] **Step 2: Write failing screen tests**
  - `'History tab lists sessions as "5 Nov 2026" with "4 exercises · 14 sets"'`;
  - `'empty history says "No sessions yet. Start the first one below."'`;
  - `'"Start session" on History opens the date step'`;
  - `'tapping a session opens the read-only summary with "BW + 10 kg × 6 · BW × 8"'`;
  - `'"Delete session" asks "Delete this session? This cannot be undone." with "5 Nov 2026 · 3 exercises · 8 sets" and returns to History'`;
  - `'tabs replace each other: back from History returns to Clients'`;
  - `'the profile shows "Weight history ›"'`.
- [ ] **Step 3: Run them, expect FAIL.** Run: `npx jest data/__tests__/history.test.ts tests/app/history.test.tsx tests/app/profile.test.tsx tests/app/session-flow.test.tsx`
- [ ] **Step 4: Implement.** Use a `FlatList` for the history rows.
- [ ] **Step 5: Run the full suite, expect PASS.** Run: `npx jest`
- [ ] **Step 6: Commit.** First rename GYM-22 to "History: list, summary and delete a finished session" and move editing to the new story. Then open the PR `feat(clients): GYM-22 History: list, summary and delete a finished session`, with the `needs-owner` label for decisions 2 and 3.

### Task 3: Edit a finished session (new story, split from GYM-22)

**Boards:** `history/session - editing`, `history/dialog - delete last exercise`.

**Files:**
- Modify: `data/sessions.ts` (including `exerciseScreenData`, which passes `before` to `lastTimeSets` when the session is finished), `app/session/[id]/index.tsx`, `app/session/[id]/reorder.tsx`, `app/session/[id]/exercise/[seId].tsx`, `app/session/[id]/summary.tsx` (the Edit button)
- Test: `data/__tests__/sessions.test.ts`, `tests/app/edit-session.test.tsx` (new)

**Interfaces:**
- Consumes: `sessionSummary`, `deleteSession` (Task 2).
- Produces:
  - `class LastExerciseError extends Error`;
  - `removeExercise(db, seId)`: now throws `LastExerciseError` when it would empty a **finished** session;
  - `updateSessionDate(db, sessionId, date: string, today: string): void`: throws on a date that isn't valid (`isValidDate`) or is after `today`;
  - `lastTimeSets(db, clientId, exerciseId, opts?: { before?: { sessionId: string; date: string; finishedAt: string | null } })`: with `before`, it excludes that session and only considers sessions with `(date, finished_at)` lower than its own;
  - `touch()`: clears the exercise's `finished_at` only in a draft.

- [ ] **Step 1: Write failing data tests**
  - `'removeExercise on the only exercise of a finished session throws LastExerciseError'` (a draft still allows it);
  - `'updateSessionDate moves the session and refuses a future or invalid date'`;
  - `'lastTimeSets with before ignores the edited session and later ones'`: there are three finished sessions on 1, 5 and 9 Nov, and editing 5 Nov shows 1 Nov;
  - `'a set change in a finished session keeps the session finished and the exercise finished'`.
- [ ] **Step 2: Write failing screen tests**
  - `'Edit on the summary opens "Edit session" with the date, numbered rows, "+ By pattern", "+ Full list" and "Done"'`;
  - `'no Finish session or Cancel session in a finished session'`;
  - `'changing the date updates the History list'`;
  - `'removing the last exercise asks "Delete this session?" ("Bench press is its only exercise. A finished session needs at least one.") and Delete returns to History'`;
  - `'the exercise page of a finished session shows "Done" instead of "Finish exercise"'`;
  - `'editing a finished session while a draft exists works and leaves the draft bar alone'`.
- [ ] **Step 3: Run them, expect FAIL.** Run: `npx jest data/__tests__/sessions.test.ts tests/app/edit-session.test.tsx`
- [ ] **Step 4: Implement.** The session page branches on `session.status`. Task 6 later adds `{ export: false }` to the draft writes; finished-session writes keep the default.
- [ ] **Step 5: Run the full suite, expect PASS.** Run: `npx jest`
- [ ] **Step 6: Update spec section 4** ("Editing a finished session") with decision 4.
- [ ] **Step 7: Commit.** Open the PR `feat(log): GYM-<new> Edit a finished session`, with the `needs-owner` label (decision 4: "+ New exercise" isn't on the board).

### Task 4: Recovery tab (GYM-23)

**Boards:** `recovery/list`, `recovery/list - never logged`.

**Files:**
- Create: `domain/recovery.ts`, `data/recovery.ts`, `app/clients/[id]/recovery.tsx`
- Create: `tests/fixtures/sessions-sample.csv` (anonymised and made up; Task 8 reuses it), `tests/fixtures/exercises-sample.csv` (the seed's 23 exercises in the legacy column format, written once by hand from `data/seed/exercises.ts`, because `legacy/data/` is gitignored), `tests/fixtures/exercises-sample.test.ts` (checks that every CSV row matches the seed's name, pattern and muscles, so the two can't drift), `tests/golden/make_recovery_golden.py`, `domain/__tests__/fixtures/recovery-golden.json`
- Test: `domain/__tests__/recovery.test.ts`, `data/__tests__/recovery.test.ts`, `tests/app/recovery.test.tsx`

**Interfaces:**
- Produces:
  - `type RecoveryStatus = 'recovering, too soon' | 'in supercompensation window (48–72 h)' | 'due' | 'never logged'`;
  - `daysBetween(from: string, to: string): number` in `domain/dates.ts`. It uses calendar days and is safe across DST: count with `Date.UTC` on the date parts;
  - `recoveryLabel(days: number): RecoveryStatus`;
  - `recoveryTable(trained: { date: string; pattern: Pattern; muscles: Muscle[] }[], today: string): { patterns: RecoveryRow<Pattern>[]; muscles: RecoveryRow<Muscle>[] }`, where `RecoveryRow<K> = { key: K; lastDate: string | null; days: number | null; status: RecoveryStatus }`. Patterns leave out `'none'`;
  - `daysAgo(days: number): string` → "today" | "1 day ago" | "N days ago";
  - `trainedFor(db, clientId): { date: string; pattern: Pattern; muscles: Muscle[] }[]`: one row per session exercise with at least one set in a finished session. Its rows are the input of `recoveryTable`.

- [ ] **Step 1: Make the golden file.** `make_recovery_golden.py` imports `legacy/gym_tracker.py` and sets `read_priorities = lambda: []`. It calls `build_recovery(sessions, exercises, date(2026, 11, 12))` on the two sample CSVs, parses the two Markdown tables it returns (`| name | last | days | status |`), and writes `{patterns: {name: days|null}, muscles: {name: days|null}}` to the JSON fixture. The test compares days and the status category, not the label text: Python writes "48-72 h" with a hyphen. Run it locally: `python tests/golden/make_recovery_golden.py`. Commit the CSV, the script and the JSON. The sample must include:
  - a pattern trained exactly 3 days before;
  - one trained 0 days before;
  - one never trained;
  - two exercises sharing a muscle on different dates.
- [ ] **Step 2: Write failing tests**
  - `recoveryLabel`: 0 and 1 → too soon, 2 and 3 → window, 4 → due;
  - `daysBetween('2026-10-24', '2026-10-26') === 2`, across the October DST change;
  - `'recoveryTable matches gym_tracker.py on the golden sample'`;
  - `'a draft and an exercise with no sets do not count'` (data);
  - screen: `'Patterns shows "Knee Dominant" / "due · 6 days ago"; the Muscles chip switches the list'`, and `'a client with no sessions shows "never logged" everywhere'`.
- [ ] **Step 3: Run them, expect FAIL.** Run: `npx jest domain/__tests__/recovery.test.ts data/__tests__/recovery.test.ts tests/app/recovery.test.tsx`
- [ ] **Step 4: Implement.** Use `fixToday` in the screen tests.
- [ ] **Step 5: Run the full suite, expect PASS.** Run: `npx jest`
- [ ] **Step 6: Commit.** Open the PR `feat(recovery): GYM-23 Recovery screen`.

### Task 5: Progress tab: Strength and Body (GYM-24)

**Boards:**
- `progress/strength`, `progress/strength - no 1RM`;
- `progress/dialog - estimate 1RM`, `progress/dialog - set 1RM`;
- `progress/body`.

**Files:**
- Modify: `domain/progress.ts` (add e1RM and best set)
- Create: `data/progress.ts`, `app/clients/[id]/progress.tsx`
- Modify: `data/sessions.ts` (move `currentOneRepMax` and `OneRepMax` to `data/progress.ts`; `sessions.ts` imports them from there, `progress.ts` never imports `sessions.ts`, and there is no re-export)
- Test: `domain/__tests__/progress.test.ts`, `data/__tests__/progress.test.ts`, `tests/app/progress.test.tsx`

**Interfaces:**
- Consumes: `bodyWeightOn` (`domain/bodyweight.ts`), `listWeights`, `formatSet`, `formatKg`.
- Produces:
  - `e1rm(weightKg: number, reps: number): number`;
  - `type ComparableSet = { loadKg: number; reps: number; date: string; shown: SetValue }`;
  - `bestSet(sets: ComparableSet[]): ComparableSet | null`: highest e1RM, then more reps, then the earliest date;
  - `strengthList(db, clientId): { exerciseId: string; nameEn: string; namePl: string | null; usesBodyweight: boolean; oneRepMax: OneRepMax | null; best: (ComparableSet & { e1rmKg: number }) | null }[]`;
  - `setOneRepMax(db, clientId, exerciseId, valueKg: number, source: 'estimated' | 'manual'): void`: it inserts a row, and history is kept;
  - `bodyProgress(db, clientId): { latest: WeightRow; changeKg: number | null; since: string | null; entries: WeightRow[] }`. `changeKg` is the latest weight minus the earliest one, and `since` is the earliest entry's date. Both are null with a single entry.

  For a bodyweight exercise, `loadKg = bodyWeightOn(weights, date)!.valueKg + (weightKg ?? 0)`, and `shown` keeps the added load. An exercise with no comparable set (cardio, for example) shows "Best set: -" and a disabled Estimate.

- [ ] **Step 1: Write failing domain tests (golden values from `gym_tracker.est_1rm`)**
  - `expect(e1rm(92.5, 3)).toBeCloseTo(101.75, 10)` (floating point gives 101.75000000000001, in Python too);
  - `e1rm(100, 1) === 100`;
  - `'bestSet ranks by e1RM, then reps, then earliest date'`;
  - `'bestSet skips sets with null weight or reps'`.
- [ ] **Step 2: Write failing data and screen tests**
  - `'strengthList uses total load for bodyweight exercises'`: with body weight 63.5 and "BW + 10 × 6", the load is 73.5;
  - `'Estimate stores round(e1rm, 2) as estimated and the 1RM line reads "1RM 101.75 kg · estimated · 12 Nov 2026"'`;
  - `'Estimate dialog reads "Back squat: 101.75 kg, from 92.5 kg × 3 on 5 Nov 2026."' and Cancel stores nothing`;
  - `'Set manually saves a typed 1RM; 0, blank and text keep Save disabled'`;
  - `'no comparable set disables Estimate'`;
  - `'a bodyweight 1RM reads "1RM 81 kg total (BW + 17.5) · manual · …"'`;
  - `'logging a set never changes the 1RM'`;
  - `'Body shows the latest weight, "−2.3 kg since 15 Sep" and the entries newest first'`;
  - `'after a stored 1RM, the exercise page enables %'`: an integration check with GYM-20.
- [ ] **Step 3: Run them, expect FAIL.** Run: `npx jest domain/__tests__/progress.test.ts data/__tests__/progress.test.ts tests/app/progress.test.tsx`
- [ ] **Step 4: Implement.**
- [ ] **Step 5: Run the full suite, expect PASS.** Run: `npx jest`
- [ ] **Step 6: Update spec section 5** (`progress.ts`) with decision 6.
- [ ] **Step 7: Commit.** Open the PR `feat(progress): GYM-24 Progress: Strength (stored 1RM, estimate and set) and Body`.

### Task 6: Settings, backup folder, JSON export and automatic export (GYM-26) — needs-owner

**Boards:** `settings/main`, and the Home tile `home` ("Settings · Backup, import" is now enabled).

**Files:**
- Create: `domain/backup.ts`, `data/backup.ts`, `data/files.ts`, `data/autoExport.ts`, `app/settings/index.tsx`
- Create: `data/testing/fakeFolder.ts` (an in-memory `BackupFolder`)
- Modify: `data/live.ts` (`mutate` options and a write listener), `app/index.tsx` (enable the Settings tile), `app/_layout.tsx` (start the auto-export), and every draft-only write in `app/session/**` and `app/clients/[id]/history.tsx` (Start session, Discard it): pass `{ export: false }` when the session is a draft
- Test: `domain/__tests__/backup.test.ts`, `data/__tests__/backup.test.ts`, `data/__tests__/autoExport.test.ts`, `tests/app/settings.test.tsx`

**Interfaces:**
- Produces:
  - `mutate(db, write, opts?: { export?: boolean })`, where `export` defaults to `true`, and `onWrite(listener: (e: { export: boolean }) => void): () => void` in `data/live.ts`;
  - `backupFileName(date: string): string` and `filesToDelete(names: string[], keep = 10): string[]`. The second keeps only names that match the pattern, and returns the oldest ones beyond `keep`;
  - `type BackupFile = { app: 'gym-assist'; formatVersion: 1; schemaVersion: number; exportedAt: string; tables: Record<string, unknown[]> }` in `domain/backup.ts`;
  - `BACKUP_TABLES` in `data/backup.ts`: every table in `data/schema.ts`, parents first (`clients`, `exercises`, `exercise_muscles`, `measurements`, `one_rep_maxes`, `sessions`, `session_exercises`, `sets`, `app_settings`);
  - `exportAll(db): BackupFile`: one entry per `BACKUP_TABLES` name;
  - `interface BackupFolder { name: string; list(): Promise<string[]>; write(name: string, text: string): Promise<void>; read(name: string): Promise<string>; remove(name: string): Promise<void> }`. `write` replaces an existing file by deleting it and creating it again;
  - `pickFolder(): Promise<{ uri: string; name: string } | null>` and `openFolder(uri: string): BackupFolder` in `data/files.ts`;
  - `writeBackup(db, folder, today): Promise<void>`: it writes the file, prunes old ones, and stores `backup.lastAt` or `backup.lastError` in `app_settings` through `mutate(…, { export: false })`, so saving the status never starts another export;
  - `startAutoExport(db, getFolder: () => BackupFolder | null): () => void`: it listens with `onWrite`, skips `export: false`, skips a database with no clients, runs once more if writes arrive while it's running, and never throws. With no folder chosen it does nothing and leaves `backup.lastError` unset (the "Backups are off" warning covers that case);
  - `backupStatus(db): { folderName: string | null; lastAt: string | null; lastError: string | null }`.

- [ ] **Step 1: Write failing tests**
  - `'backupFileName("2026-11-12") is gym-assist-backup-2026-11-12.json'`;
  - `'filesToDelete keeps the newest 10 and ignores other files'`;
  - `'exportAll has every schema table and the schemaVersion from the journal'`;
  - `'two exports on one day leave one file'`;
  - `'auto-export runs after finishSession and a weight change, not after an export: false write'`;
  - `'one write gives exactly one export'`: the status save doesn't loop;
  - `'choosing a folder writes no file'` (the folder is saved with `export: false`);
  - `'an empty database (no clients) is never exported automatically; Export now still writes it'`;
  - `'with no folder, auto-export writes nothing and sets no lastError'`;
  - `'writing over today's file with shorter text leaves exactly the new text'` (fake folder);
  - `'a folder write that fails stores lastError and does not throw'`;
  - screen: `'Settings shows the folder name and "today 18:42", Export writes a file, and with no folder Export asks for one first'`.
- [ ] **Step 2: Run them, expect FAIL.** Run: `npx jest domain/__tests__/backup.test.ts data/__tests__/backup.test.ts data/__tests__/autoExport.test.ts tests/app/settings.test.tsx`
- [ ] **Step 3: Implement.** `data/files.ts` is the only file that imports `expo-file-system`. Jest mocks it in `tests/` setup, the same way the datetime picker is mocked.
- [ ] **Step 4: Run the full suite, expect PASS.** Run: `npx jest` and `npx tsc --noEmit`
- [ ] **Step 5: Phone check.** A PR can't prove these, so they go into Task 10: the chosen folder still works after the app is closed and reopened, overwriting today's file leaves valid JSON, and whether Google Drive appears in the folder picker (decision 7).
- [ ] **Step 6: Commit.** First rename GYM-26 to "JSON export and automatic export". Then open the PR `feat(db): GYM-26 JSON export and automatic export` with the `needs-owner` label (it changes `mutate`, which every screen uses).

### Task 7: Backup warning on Home and Android Auto Backup (GYM-27) — needs-owner

**Boards:** `home - backup warning`.

**Files:**
- Create: `ui/Banner.tsx` (the `kit/banner`: warning colour `#FEF3C7`, navy text, a "FIX" action)
- Modify: `app/index.tsx`, `app.json` (`android.allowBackup: true`)
- Test: `tests/app/home.test.tsx`, `tests/config.test.ts` (new)

**Interfaces:**
- Consumes: `backupStatus` (Task 6).

- [ ] **Step 1: Write failing tests**
  - `'no folder shows "Backups are off: choose a folder"; FIX opens Settings'`;
  - `'a failed last export shows "Last backup failed: check the folder"'`;
  - `'the banner and the "Session in progress" bar show together'`;
  - `'no banner after a successful export'`;
  - `'app.json keeps android.allowBackup true'`.
- [ ] **Step 2: Run them, expect FAIL.** Run: `npx jest tests/app/home.test.tsx tests/config.test.ts`
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run the full suite, expect PASS.** Run: `npx jest`
- [ ] **Step 5: Commit.** Open the PR `feat(infra): GYM-27 Android Auto Backup and backup warning` with the `needs-owner` label (app config). Update GYM-27's description: Home, not Clients.

### Task 8: CSV import into "Me" (GYM-25)

**Boards:** `settings/main` (the "Import history (CSV)" row), `settings/import - done`, `settings/import - error`.

**Files:**
- Create: `domain/csv.ts`, `domain/importRows.ts`, `data/import.ts`, `app/settings/import.tsx`
- Modify: `tests/fixtures/sessions-sample.csv` (from Task 4): make sure it has a BOM, `\r\n`, a quoted note with a comma, L/P sides, a cardio row, a blank weight and blank reps. Regenerate the recovery golden file if its rows change.
- Modify: `app/settings/index.tsx`, `app/create-profile.tsx` (a `?then=import` return)
- Test: `domain/__tests__/csv.test.ts`, `domain/__tests__/importRows.test.ts`, `data/__tests__/import.test.ts`, `tests/app/import.test.tsx`

**Interfaces:**
- Produces:
  - `parseCsv(text: string): string[][]`: RFC 4180 quoting; it strips a BOM, accepts `\n` and `\r\n`, and skips blank lines;
  - `type ImportRow = { line: number; date: string; exerciseEn: string; setNo: number; side: string | null; weightKg: number | null; reps: number | null; heightCm: number | null; speedKmh: number | null; minutes: number | null; note: string | null }`;
  - `validateImport(table: string[][], knownNames: Set<string>, today: string): { ok: true; rows: ImportRow[] } | { ok: false; line: number; message: string; unknownNames: string[] }`. Column rules:
    - **header:** must hold exactly the 10 columns `date, exercise_en, set_no, side, weight_kg, reps, height_cm, speed_kmh, minutes, note`, in any order;
    - **date:** valid and not after `today`;
    - **`set_no`:** a whole number of at least 1;
    - **weight and reps:** through `parseWeight` and `parseReps`;
    - **`side`:** `''`, `L`, `P` or `per side`;
    - **height, speed and minutes:** numbers of at least 0, or blank;
    - **line:** the file line number, with the header as line 1;
    - **unknown names:** matched ignoring case and surrounding spaces. Every unknown name is listed, and `line` is the first row that has one;
  - `importHistory(db, rows: ImportRow[]): { sessions: number }`. The screen says "1 session" or "N sessions":
    - into "Me" only; it throws `NoSelfError` when there is no "Me", and `DatesTakenError(dates: string[])`;
    - one finished session per date;
    - exercises are ordered by their first appearance, and sets keep `set_no`, `side` and every column.

- [ ] **Step 1: Write failing tests**
  - `csv`: a BOM, `\r\n`, `"a, b"` and `""` escapes;
  - `importRows`:
    - `'unknown names are all listed and nothing is accepted'`;
    - `'a bad reps value reports its line'`;
    - `'22,5 is 22.5'`;
    - `'the same set_no with L and P is kept twice'`;
  - `import`:
    - `'the sample imports 6 sessions into Me with every column kept'`;
    - `'a date Me already has is refused with nothing written'`;
    - `'no Me throws NoSelfError'`;
  - screen:
    - `'success shows "6 sessions imported into Me." and "You can see them in Me › History."'`;
    - `'one session reads "1 session imported into Me."'`;
    - `'error shows "Nothing was imported", the row and the bullet list of names, and "Choose another file"'`;
    - `'without Me the import opens Create my profile, then continues'`.
- [ ] **Step 2: Run them, expect FAIL.** Run: `npx jest domain/__tests__/csv.test.ts domain/__tests__/importRows.test.ts data/__tests__/import.test.ts tests/app/import.test.tsx`
- [ ] **Step 3: Implement.** Pick the file with `File.pickFileAsync` (through `data/files.ts`: add `pickTextFile(): Promise<{ name: string; text: string } | null>`). The import is one `mutate`, which also triggers the auto-export.
- [ ] **Step 4: Run the full suite, expect PASS.** Run: `npx jest`
- [ ] **Step 5: Update spec sections 5 and 6** with decision 9 (the create-profile step and the refused dates).
- [ ] **Step 6: Commit.** Open the PR `feat(import): GYM-25 CSV import of existing history`, with the `needs-owner` label for decision 9 (the refuse-duplicates rule and the create-profile step).

### Task 9: Restore from backup (new story, split from GYM-26)

**Boards:** `settings/dialog - restore`, `settings/restore - done`.

**Files:**
- Modify: `domain/backup.ts`, `data/backup.ts`, `app/settings/index.tsx`
- Create: `app/settings/restore-done.tsx`
- Test: `domain/__tests__/backup.test.ts`, `data/__tests__/restore.test.ts`, `tests/app/restore.test.tsx`

**Interfaces:**
- Consumes: `exportAll`, `BackupFile`, `BackupFolder`, `pickTextFile` (Tasks 6 and 8).
- Produces:
  - `readBackup(text: string, currentSchema: number, tableNames: readonly string[]): { ok: true; file: BackupFile } | { ok: false; message: string }` in `domain/backup.ts`. The screen passes `BACKUP_TABLES`, so domain never imports data. It refuses:
    - text that isn't JSON;
    - a file whose `app` isn't `'gym-assist'`;
    - a `formatVersion` other than 1;
    - a `schemaVersion` other than the app's (decision 8);
    - a table missing from `tableNames`.

    It also checks that dates are `YYYY-MM-DD` (the deferred note from GYM-25).
  - `restoreAll(db: DbOrTx, file: BackupFile): { clients: number; sessions: number; date: string }`. `clients` counts every client, archived ones included. `sessions` counts finished sessions. `date` is the local date of `exportedAt`:
    - it deletes the children first, inserts the parents first, and keeps this phone's `backup.*` settings;
    - it is a repository function: the restore screen wraps it in one `mutate(db, tx => restoreAll(tx, file), { export: false })`, so a failure rolls back and nothing changes, and today's backup isn't overwritten;
    - before that, the screen writes `gym-assist-before-restore.json` to the folder, following decision 8's rules (skipped with no folder or no clients; a failed write stops the restore).

- [ ] **Step 1: Write failing tests**
  - `'export then restore into an empty database gives identical tables'`: a round trip over every table;
  - `'a newer schemaVersion is refused and nothing changes'`;
  - `'a row that breaks a constraint rolls the whole restore back'`;
  - `'restore keeps this phone's backup folder'`;
  - `'restore writes gym-assist-before-restore.json first and does not overwrite today's backup'`;
  - `'with no folder, or no clients, restore skips the safety file and still restores'`;
  - `'a failed safety write stops the restore and changes nothing'`;
  - `'an older schemaVersion is refused and nothing changes'`;
  - screen:
    - `'the dialog says "This replaces all data in the app with gym-assist-backup-2026-11-09.json."'`;
    - `'done says "All data now comes from the backup of 9 Nov 2026: 4 clients, 61 sessions." and "Go to clients" opens Clients'`;
    - `'a bad file shows its message and changes nothing'`.
- [ ] **Step 2: Run them, expect FAIL.** Run: `npx jest data/__tests__/restore.test.ts tests/app/restore.test.tsx domain/__tests__/backup.test.ts`
- [ ] **Step 3: Implement.** After a restore, any open screen re-reads through `useLive`. The draft bar shows if the backup holds a draft.
- [ ] **Step 4: Run the full suite, expect PASS.** Run: `npx jest`
- [ ] **Step 5: Update spec section 5** (Restore) with decision 8, and create the backlog ticket "Restore backups from an older schema version" under GYM-4.
- [ ] **Step 6: Commit.** Open the PR `feat(db): GYM-<new> Restore from backup` with the `needs-owner` label (it changes the spec).

### Task 10: Sprint 2 review on the phone (the Stage 2 "done when")

The owner runs **build-android → preview** and installs the APK over the Sprint 1 build, so the data is kept. Claude never runs the build.

- [ ] **Step 1: Checks on the phone.**
  - The Sprint 1 data is still there, so the migration from Task 1 ran.
  - Choose a backup folder (try Google Drive first), close the app, reopen it, Export twice, and open the file to check it's valid JSON (decision 7).
  - Import the real `legacy/data/sessions.csv` into "Me".
  - Compare the Recovery tab with `python legacy/gym_tracker.py status` on the same day: the days and the status for each row. The wording differs ("48-72 h" with a hyphen).
  - Set a 1RM with Estimate, then log a set in %.
  - Edit and delete a finished session.
- [ ] **Step 1b: Backup file names (PR #40 review, N1).**
  - Settings shows the folder's plain name (for example "Gym Assist", not "primary:Gym Assist").
  - Export twice on one day: the folder has one `gym-assist-backup-<today>.json`, with no "(1)" copy.
  - If a Drive folder is offered, repeat both checks there.
- [ ] **Step 1c: Android Auto Backup (PR #41 review).**
  - Device backup is on in the phone's settings.
  - After a day, or after `adb shell bmgr backupnow com.jedrosz.gymassist`, Gym Assist is listed under Settings › Google › Backup.
  - The app's data stays under Auto Backup's 25 MB limit.
- [ ] **Step 2: Restore test.** Before uninstalling, note the newest backup file's name and its clients and sessions. Uninstall, reinstall, choose the same folder (no file must appear), restore from the noted file, and check the counts. Restore before making any other change: a weight entry or a new client made first would be backed up over today's file.
- [ ] **Step 3: Real use.** Three real sessions logged with the app (the spec's "done when").
- [ ] **Step 4: Record the outcome.** Write the findings as Jira tickets, the sprint summary on GYM-3, and close GYM-3 when every "done when" item holds.
