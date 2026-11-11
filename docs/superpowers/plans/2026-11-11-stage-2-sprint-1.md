# Stage 2, Sprint 1: Log a Real Session — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** At the end of this sprint, a real session can be logged on the phone. That covers the local database, the exercise library with seed data, Welcome, Home, the Exercise library screens and Add exercise, clients with their profile, and the whole log-session flow. This is spec section 3, Sprint 1. Sprint 2 (history, recovery, progress, import, backups) gets its own plan when this one is done.

**Architecture:**
- **Layers (CLAUDE.md):**
  - `domain/` holds pure functions.
  - `data/` holds the Drizzle schema, migrations and repository functions. Every function takes the database as its first argument.
  - `app/` holds Expo Router screens built from shared components in `ui/`.
- **One database type for the phone and for tests:** the phone uses `expo-sqlite` and Jest uses `better-sqlite3`, and both are synchronous Drizzle databases. Data tests and component tests run against a real in-memory database migrated with the same SQL files.

**Tech Stack:** Expo SDK 58, Expo Router, TypeScript, Jest (`jest-expo`), React Native Testing Library, Drizzle ORM and drizzle-kit, expo-sqlite, better-sqlite3 (tests only), expo-file-system, expo-crypto, @expo-google-fonts/poppins, @react-native-community/datetimepicker.

**Spec:** `docs/superpowers/specs/2026-10-28-gym-assist-app-design.md` (read sections 4–6 and 9). **Designs:** `docs/design/README.md`. Each screen task names its boards; follow them.

## Global Constraints

- **Layers:** `app/` → `data/` → `domain/`, and each layer imports only the layer below it. `ui/` is presentation only: it imports neither `data/` nor `domain/`. `domain/` imports no React, Expo or Drizzle.
- **Every table** has UUID `id`s from `expo-crypto` `randomUUID()` and `updated_at`. There are two exceptions: `exercise_muscles` (composite key) and `app_settings` (keyed by `key`) have `updated_at` but no UUID. All timestamps are ISO strings. Dates are `YYYY-MM-DD`, using the phone's **local** date.
- **Units:** kg and cm only. A blank value displays as `-`.
- **Number input:** weight accepts `22,5` or `22.5` (both mean 22.5). Reps accept whole numbers only. Negative numbers and text are blocked in the field. Blank is saved as NULL.
- **UI:** English. Exercise names show the English name with the Polish one under it. Patterns and categories `KD` and `HD` display as "Knee Dominant" and "Hip Dominant".
- **Exact strings (spec):**
  - "First time"; "Last time: 60 kg × 8, 60 kg × 8, 62.5 kg × 6"; "BW + 10 kg × 6"; "BW × 8";
  - "Finish exercise", "Finish session", "Cancel session", "Discard this session?";
  - "Remove this exercise and its sets?";
  - "A session is already in progress" with "Resume", "Finish it", "Discard it";
  - "Session in progress";
  - "Replace the weight for this date?", "Delete this weight entry?";
  - "An exercise with this name already exists";
  - "Set a 1RM in Progress to use %";
  - "Create my profile", "Skip", "No clients yet", "Add client", "Add my profile";
  - "The update could not finish".
- **Style (design README):**
  - colours: navy `#0F172A`, accent `#233662`, white, background `#F2F2F2`, slate `#364151`, muted `#94A3B8`, line `#E2E8F0`, on-navy `#CBD5E1`, warning `#FEF3C7`;
  - type: Poppins 400/600, text at least 14 px;
  - controls: pill buttons 56 px high with radius 28, tap targets at least 48 × 48, main actions at the bottom.
- **No network code. Android only.**
- **Per-ticket workflow (CLAUDE.md "Working on a ticket"):** one branch, one PR and one squash commit per ticket.
  - The PR title is `<type>(<scope>): GYM-<n> <ticket name>`.
  - Tests come first.
  - The review subagent reviews every PR.
  - A PR gets `needs-owner` when it changes the schema, adds a library or a folder, or changes the spec.
- **Every task's "Commit" step** is that ticket's PR, merged only after green CI, the subagent's approval, and the owner's approval where the PR needs it.

## Owner decisions this plan asks for

These come with the plan PR. The spec is updated in the task named.

1. **New libraries** (Tasks 2 and 3): the ones listed under Tech Stack.
2. **New folder `ui/`** (Task 3): shared components and theme tokens. Expo Router turns every file in `app/` into a screen, so components can't live there. `ui/` counts as part of the app layer.
3. **New table `app_settings`** (`key`, `value`, `updated_at`) (Task 2). It holds the Welcome choice now, and the backup folder and last export status in Sprint 2.
4. **Our own live-query hook** (Task 2) instead of Drizzle's `useLiveQuery`. Drizzle's hook works only on the phone's expo-sqlite, so it can't run in Jest. Ours re-runs a query after any write made through `data/`. Same behaviour: screens never show stale data.
5. **"Last time" counts finished sessions only** (Task 7), like recovery. A draft, including the current session, never counts.
6. **Before Sprint 2, the Settings tile on Home is shown dimmed and does nothing** (Task 3). The spec's three tiles stay. Settings content arrives with GYM-25 and GYM-26.
7. **The client screen shows only Profile and "Start session"** in Sprint 1 (Task 6). History, Recovery and Progress tabs arrive in Sprint 2.

## Review Focus

1. **The app is killed during a session:** reopening it shows Home with the "Session in progress" bar. Tapping the bar opens the exercise that was still open, or the session page if none was open. Pinned in Task 9 (`resumePoint`).
2. **Messy number input** (`22,5`, `22.5`, `,5`, `22,,5`, `-5`, `1e3`, `8.5` for reps, spaces): valid values parse, and anything else is rejected rather than saved wrong. Pinned in Task 8 (`parseWeight` and `parseReps`).
3. **Back-dated and draft sessions:** "Last time" comes from the latest finished session by date (then by `finished_at`). Never from a draft, the current session, or another client. Pinned in Task 7.
4. **Exercise names differing only by case or spaces** (`"  dips "` vs `"Dips"`, a custom name equal to a seed name): duplicates are refused, and the seed never overwrites a custom exercise. Pinned in Tasks 4 and 5.
5. **Deleting a middle set, then adding one:** sets 1, 3, 4 stay numbered, and the new set is 5. Moving the top exercise up, or the bottom one down, changes nothing. Pinned in Tasks 8 and 9.

---

### Task 1: Tidy the spec and Stage 1 plan wording (GYM-75)

**Files:**
- Modify: `docs/superpowers/plans/2026-11-10-stage-1-ux-design.md` (top note)
- Modify: `docs/superpowers/specs/2026-10-28-gym-assist-app-design.md` (lines 61, 83–100, 136–138, 165, 221)

**Interfaces:**
- Consumes: none.
- Produces: none.

- [ ] **Step 1:** Make each edit listed in GYM-75. One of them adds the draft-prompt title "A session is already in progress" to spec section 4 ("One draft at a time").
- [ ] **Step 2:** Check that each new string is in the files:

  ```bash
  grep -c "A session is already in progress" docs/superpowers/specs/2026-10-28-gym-assist-app-design.md
  ```

  Expected: `1`. The plan's top note mentions `docs/design/README.md`.
- [ ] **Step 3: Commit.** PR `docs(design): GYM-75 Tidy the spec and Stage 1 plan wording after Stage 1`, labelled `needs-owner` because it changes the spec.

### Task 2: Database schema, migrations, snapshot and live queries (GYM-16)

**Files:**
- Create:
  - `data/schema.ts`
  - `data/types.ts`
  - `data/settings.ts`
  - `data/live.ts`
  - `data/db/prepare.ts`
  - `data/db/open.ts`
  - `data/testing/testDb.ts`
  - `data/migrations/*` (generated)
  - `drizzle.config.ts`
  - `babel.config.js`
  - `metro.config.js`
  - `jest.setup.ts`
- Test:
  - `data/__tests__/schema.test.ts`
  - `data/__tests__/prepare.test.ts`
  - `data/__tests__/live.test.tsx`
- Modify:
  - `package.json`, `jest.config.js`, `.prettierignore`, `eslint.config.js`
  - `app.json` (expo-sqlite plugin)
  - the spec: the `app_settings` table and the `exercise_muscles` key in section 6, and the hook in section 5's `app/` paragraph

**Interfaces:**
- Produces:
  - `type Db = BaseSQLiteDatabase<'sync', unknown, typeof schema>`, and `type Tx` for the transaction handle Drizzle passes to `db.transaction` (`data/types.ts`).
  - `type DbOrTx = Db | Tx`. **Every repository function in later tasks takes `DbOrTx` as its first argument and never calls `mutate` itself.** Nested transactions are savepoints on better-sqlite3 but throw on the phone's expo-sqlite.
  - `createTestDb(): Db` returns an in-memory better-sqlite3 database. It is migrated from `data/migrations` with foreign keys **off**, then `PRAGMA foreign_keys = ON`.
  - `newId(): string` (`data/types.ts`) uses `expo-crypto` `randomUUID()`. A Jest setup file (`jest.setup.ts`) mocks `expo-crypto` with Node's `crypto.randomUUID`.
  - `nowIso(): string`.
  - Drizzle tables: `clients`, `measurements`, `exercises`, `exerciseMuscles`, `oneRepMaxes`, `sessions`, `sessionExercises`, `sets`, `appSettings`.
  - `getSetting(db: DbOrTx, key: string): string | null` and `setSetting(db: DbOrTx, key: string, value: string): void` (`data/settings.ts`).
  - In `data/live.ts`:
    - `mutate<T>(db: Db, write: (tx: Tx) => T): T` runs `write` in one transaction, then calls `notifyDataChanged()`. Screens call it **once per user action**, for example `mutate(db, tx => createClient(tx, input))`.
    - `notifyDataChanged(): void`.
    - `useLive<T>(read: (db: Db) => T, deps: unknown[]): T`.
    - `DbProvider` and `useDb(): Db`.
  - `prepareDatabase(deps: PrepareDeps): Promise<PrepareResult>` (`data/db/prepare.ts`), where:
    - `PrepareDeps = { appliedVersion(): number; targetVersion(): number; snapshotTo(name: string): void; listSnapshots(): string[]; deleteSnapshot(name: string): void; restoreFrom(name: string): void; migrate(): Promise<void> }`;
    - `PrepareResult = { ok: true } | { ok: false; error: string }`.
  - `openAppDatabase(): Promise<{ db: Db; result: PrepareResult }>` (`data/db/open.ts`, phone only). The Drizzle `db` is built only **after** prepare finishes, because a restore closes the first connection. `openAppDatabase` also seeds the exercise library once Task 4 exists.

- [ ] **Step 1: Install.**

  ```bash
  npx expo install expo-sqlite expo-file-system expo-crypto
  ```

  Then `npm i drizzle-orm` and `npm i -D drizzle-kit better-sqlite3 @types/better-sqlite3 babel-plugin-inline-import`.

  Set up `drizzle.config.ts` (`dialect: 'sqlite'`, `driver: 'expo'`, `schema: './data/schema.ts'`, `out: './data/migrations'`). The `.sql` files need two settings: `babel.config.js` uses `babel-preset-expo` plus `['inline-import', { extensions: ['.sql'] }]`, and `metro.config.js` adds `sql` to `resolver.sourceExts`.

  Add `data/migrations/` to `.prettierignore` and to the ESLint `ignores`. Generated files would fail CI's format and lint checks.

  Add `jest.setup.ts` (the `expo-crypto` mock) through `setupFiles` in `jest.config.js`.

- [ ] **Step 2: Write the failing schema tests** in `data/__tests__/schema.test.ts` (`@jest-environment node`). Each test uses `createTestDb()`:
  - `test('every table has id and updated_at')`: take the table list from the Drizzle schema, not from `sqlite_master`, which also holds `__drizzle_migrations`. Read `PRAGMA table_info` for each. Each one has `id` and `updated_at`, with two exceptions:
    - `exercise_muscles` has `updated_at` and a composite primary key (`exercise_id`, `muscle`);
    - `app_settings` has `key` as its primary key, plus `updated_at`.
  - `test('only one draft session')`: a second `status = 'draft'` session throws, and two finished sessions are fine.
  - `test('exercise name_en is unique ignoring case')`: inserting "Dips" and then "dips" throws.
  - `test('only one client can be Me')`: a second `is_self = 1` insert throws, and a second `is_self = 0` insert works.
  - `test('one weight per client, type and date')`: a duplicate (`client_id`, `type`, `date`) throws.
  - `test('deleting a session deletes its exercises and sets')`: cascade.
  - `test('sets keep nullable backlog columns')`: `side`, `height_cm`, `speed_kmh`, `minutes` and `note` accept NULL.
- [ ] **Step 3: Run** `npx jest data/__tests__/schema.test.ts`. Expected: FAIL, because `createTestDb` is not defined.
- [ ] **Step 4: Write `data/schema.ts`.** Copy the columns exactly from spec section 6, and add `app_settings`.
  - `clients.gender` holds `female`, `male`, `other`, `prefer_not_to_say` or NULL.
  - Booleans are integers in boolean mode.
  - Indexes:
    - a unique index on `lower(name_en)`;
    - a partial unique index on `clients(is_self) WHERE is_self = 1`;
    - a partial unique index on `sessions(status) WHERE status = 'draft'` (the one-draft rule, enforced by the database too);
    - a unique index on `measurements(client_id, type, date)`.
  - Foreign keys use `ON DELETE CASCADE` from sessions → session_exercises → sets, and from clients → measurements.

  Run `npx drizzle-kit generate`. Then write `createTestDb`, which uses the `drizzle-orm/better-sqlite3/migrator` `migrate` with `migrationsFolder: 'data/migrations'`.
- [ ] **Step 5: Run the schema tests.** Expected: PASS.
- [ ] **Step 6: Write the failing `prepare` tests** with fake deps that record their calls:
  - `test('applied equals target: no snapshot, no migrate')`.
  - `test('fresh install (applied 0): migrates without a snapshot')`.
  - `test('applied 1, target 2: snapshots pre-migration-v2.db, then migrates')`.
  - `test('keeps only the last 3 snapshots')`: existing snapshots v1, v2 and v3, then v4 is taken, so v1 is deleted. Include v9 and v10 to prove the sort is numeric.
  - `test('a rejected migrate restores the snapshot and resolves ok:false with the message')`.
  - In `schema.test.ts`: `test('a table-rebuild migration keeps child rows')`. Create a client with a weight, run a raw `DROP TABLE`-and-recreate of `clients` the way `createTestDb` migrates (foreign keys off), and the `measurements` row is still there.
- [ ] **Step 7: Implement `prepareDatabase`.** It's async and awaits `migrate()`, so a rejected promise is caught. Sort snapshots by version number, not as text.

  Write `openAppDatabase` for the phone with the SDK 58 `expo-file-system` API (`Paths`, `Directory`, `File`):
  1. Open the raw database: `openDatabaseSync('gym-assist.db')`, with `PRAGMA foreign_keys = OFF`. The Drizzle migrator runs all pending migrations inside one transaction, where drizzle-kit's own `PRAGMA foreign_keys=OFF` has no effect. With foreign keys on, a migration that rebuilds a table (`DROP TABLE`) would cascade and **silently delete** the exercises, sets or weights that belong to it.
  2. `appliedVersion`: the row count of `__drizzle_migrations`, or 0 when that table doesn't exist yet (fresh install).
  3. `targetVersion`: the number of entries in the migration journal.
  4. `snapshotTo`: create the `backups/` directory if it's missing, delete any existing target file, then run `VACUUM INTO` on the plain file path, not the `file://` URI.
  5. `restoreFrom`:
     1. Close the database.
     2. Delete the database file and its `-wal` and `-shm` files, because `File.copy` may not overwrite.
     3. Copy the snapshot into place. `defaultDatabaseDirectory` is a plain path, so build the `File` from it explicitly.
     4. Reopen the database and run `PRAGMA foreign_keys = ON`.
  6. `migrate`: the `drizzle-orm/expo-sqlite/migrator` `migrate` with `data/migrations/migrations.js`. After it succeeds, run `PRAGMA foreign_key_check`. Any row it reports counts as a failed migration, so the snapshot is restored. Then run `PRAGMA foreign_keys = ON`.
  7. Seed (Task 4) inside one `db.transaction`, so a crash mid-seed leaves no exercise without its muscles.

  `openAppDatabase` is phone-only glue; the review checks it by reading. The owner's phone test in Task 10 exercises it for real.
- [ ] **Step 8: Write the failing `live` test** (`data/__tests__/live.test.tsx`).

  `test('useLive re-runs after notifyDataChanged')`:
  1. Render a component that shows `useLive(db => db.select().from(clients).all().length, [])` inside a `DbProvider` with a test database.
  2. Insert a client, then call `notifyDataChanged()` inside `act`.
  3. The text changes from `0` to `1`.
- [ ] **Step 9: Implement `data/live.ts`.**
  - A module-level version counter and a set of listeners.
  - `useLive` uses `useSyncExternalStore` with the **version number** as its snapshot. It re-runs `read` when the version changes. Returning a fresh query result as the snapshot would loop forever.
  - Write `mutate` as in the Interfaces block. Add `test('mutate rolls back and does not notify when write throws')`.
- [ ] **Step 10: Run `npm run lint && npm run typecheck && npx jest`.** Expected: all pass.
- [ ] **Step 11: Update the spec:**
  - section 6: `app_settings` (`key`, `value`, `updated_at`): app-wide settings such as the Welcome choice;
  - section 6: `exercise_muscles` gets `updated_at`, with (`exercise_id`, `muscle`) as its key;
  - section 5: "screens read through `useLive` in `data/live.ts`, which re-runs after every write made through `data/`" replaces the `useLiveQuery` sentence.
- [ ] **Step 12: Commit.** PR `feat(db): GYM-16 Database schema, migrations and pre-migration snapshot`, labelled `needs-owner` (schema, libraries, spec).

### Task 3: UI kit, start-up gate, Welcome, Home and Clients list (GYM-18)

**Files:**
- Create:
  - `ui/theme.ts`
  - `ui/AppBar.tsx`, `ui/Button.tsx` (primary and secondary), `ui/ListRow.tsx`, `ui/SetRow.tsx`, `ui/NumberField.tsx`, `ui/TextField.tsx`, `ui/SearchField.tsx`, `ui/Banner.tsx`, `ui/Dialog.tsx`, `ui/Tile.tsx`, `ui/DateField.tsx`
  - `domain/dates.ts`
  - `domain/clients.ts`
  - `data/clients.ts`
  - `app/welcome.tsx`, `app/create-profile.tsx`, `app/clients/index.tsx`, `app/clients/add.tsx`
- Modify:
  - `app/_layout.tsx` (fonts, the database and the gate)
  - `app/index.tsx` (Home)
- Test:
  - `domain/__tests__/dates.test.ts`
  - `domain/__tests__/clients.test.ts`
  - `data/__tests__/clients.test.ts`
  - `app/__tests__/welcome.test.tsx`
  - `app/__tests__/home.test.tsx`
  - `app/__tests__/clients.test.tsx`
- **Boards** (from the README):
  - `app/welcome`, `app/create my profile`
  - `home`
  - `clients/list - only me`, `clients/list - empty`, `clients/add`
  - `app/error - migration failed`

**Interfaces:**
- Consumes: `Db`, `mutate`, `useLive`, `useDb`, `getSetting`, `setSetting`, `openAppDatabase` (Task 2).
- Produces:
  - `todayLocal(now: Date): string`, `isValidDate(s: string): boolean`, `formatDayMonth(d: string): string` (`'2026-11-07'` → `'7 Nov'`) and `formatDayMonthYear(d: string): string` (`'2026-10-27'` → `'27 Oct 2026'`), all in `domain/dates.ts`. Tasks 6 and 8 use the formatters.
  - `fullName(first: string, last: string | null): string` and `ageOn(dateOfBirth: string, today: string): number` (`domain/clients.ts`).
  - `type NewClient = { firstName: string; lastName?: string; gender?: Gender; dateOfBirth?: string; heightCm?: number; isSelf?: boolean; weightKg: number; weightDate: string }`.
  - `createClient(db: DbOrTx, c: NewClient): string` inserts the client and its first weight. The screen wraps it in one `mutate`.
  - `listClients(db): ClientListItem[]` returns active clients, "Me" first, then by first name and last name.
  - `getSelf(db): ClientRow | null`.
  - `countClients(db): number` counts active clients, including "Me".
  - `WELCOME_DONE = 'welcome_done'` (settings key).
  - The ui kit's props are free for the implementer to choose; later tasks reuse the components.

- [ ] **Step 1: Install.**

  ```bash
  npx expo install @expo-google-fonts/poppins @react-native-community/datetimepicker
  ```

- [ ] **Step 2: Write the failing domain tests:**
  - `todayLocal(new Date(2026, 10, 11, 0, 30))` is `'2026-11-11'`. That's 23:30 UTC on 10 November, so a UTC-based implementation (`toISOString`) fails. `jest.setup.ts` sets `process.env.TZ = 'Europe/Warsaw'`, because CI runs in UTC.
  - `formatDayMonth('2026-11-07')` is `'7 Nov'`, and `formatDayMonthYear('2026-10-27')` is `'27 Oct 2026'`.
  - `isValidDate('2026-02-30')` is `false`.
  - `fullName('Anna', null)` is `'Anna'`, and `fullName('Anna', 'Kowalska')` is `'Anna Kowalska'`.
  - `ageOn('1990-11-12', '2026-11-11')` is `35`, and `ageOn('1990-11-11', '2026-11-11')` is `36`.
- [ ] **Step 3: Write the failing data tests:**
  - `createClient` with `weightKg: 82` creates one `measurements` row: `type 'weight'`, value 82, on `weightDate`.
  - `createClient` with no first name, or with a blank one, throws.
  - `listClients` puts "Me" first and leaves out archived clients.
  - `createClient({isSelf: true})` throws when a "Me" already exists.
- [ ] **Step 4: Write the failing screen tests.** Each one renders the screen inside `DbProvider` with `createTestDb()`, and mocks expo-router's `router`:
  - `welcome`: "Skip" sets `welcome_done` and goes to Home. "Create my profile" goes to `create-profile`.
  - `create-profile`: "Save" stays disabled until the first name and body weight are filled in. Saving creates "Me" and sets `welcome_done`.
  - `home`: three tiles in the order Clients, Settings, Exercise library. The Clients tile shows "0 clients", then "1 client" after `act(() => mutate(db, tx => createClient(tx, …)))`. The Settings tile is disabled.
  - `clients`:
    - with no clients, it shows "No clients yet", the "Add client" button and the "Add my profile" row;
    - with "Me", it shows "Me" first, marked "me", and no "Add my profile" row.
  - `startup error` (`jest.mock` `data/db/open`, `@expo-google-fonts/poppins` and `expo-splash-screen`, because the real modules load native code): when `openAppDatabase` resolves `{ ok: false, error: 'migration v4 failed' }`, the layout shows "The update could not finish" and "Error: migration v4 failed". The `app/error - migration failed` board belongs to GYM-18; note the move from GYM-16 in the PR.
- [ ] **Step 5: Run the tests.** Expected: FAIL.
- [ ] **Step 6: Implement.**
  - `ui/theme.ts` holds the Global Constraints tokens. Build the components to match the boards.
  - `app/_layout.tsx`:
    1. Keep the splash screen up (`SplashScreen.preventAutoHideAsync`) until the fonts are loaded and `await openAppDatabase()` resolves.
    2. If `ok` is false, render the `app/error - migration failed` content: "The update could not finish", the error text and "Close app".
    3. Wrap the app in `DbProvider`.
    4. Redirect to `/welcome` while `welcome_done` is unset.
  - The Home tile counts use `useLive`.
- [ ] **Step 7: Run `npm run lint && npm run typecheck && npx jest`.** Expected: all pass.
- [ ] **Step 8: Commit.** First rename GYM-18 in Jira to "Welcome, Home and clients list", and create the Task 6 ticket so that the profile part moves to it. Then open PR `feat(clients): GYM-18 Welcome, Home and clients list`, labelled `needs-owner` (new libraries and the `ui/` folder). Cite PR #21, decision 6, for the dimmed Settings tile. The title must match the renamed ticket.

### Task 4: Exercise catalogue, seed and library screens (GYM-17)

**Files:**
- Create:
  - `domain/catalogue.ts`
  - `data/seed/exercises.ts`
  - `data/exercises.ts`
  - `app/library/index.tsx`, `app/library/[id].tsx`
- Modify:
  - `data/db/open.ts` (seed after the migrations, so it happens before Welcome shows)
  - `app/index.tsx` (the library tile count and navigation)
- Test:
  - `domain/__tests__/catalogue.test.ts`
  - `data/__tests__/exercises.test.ts`
  - `app/__tests__/library.test.tsx`
- **Boards:** `library/list`, `library/detail`.

**Interfaces:**
- Produces:
  - `CATEGORIES`, `TRAINING_TYPES`, `PATTERNS` and `MUSCLES` (`readonly`), with the types `Category`, `TrainingType`, `Pattern` and `Muscle`.
  - `displayName(code: string): string` turns `'KD'` into `'Knee Dominant'` and `'HD'` into `'Hip Dominant'`, and returns anything else unchanged.
  - `muscleName(m: Muscle): { en: string; pl: string }`.
  - `type SeedExercise = { nameEn; namePl; category: Category; trainingType: TrainingType; pattern: Pattern; usesBodyweight: boolean; muscles: Muscle[] }` and `SEED_EXERCISES: SeedExercise[]`.
  - `seedExercises(db: DbOrTx, seed: SeedExercise[]): number` returns the number of rows inserted. Count them with `.returning()`, because `.run()` returns `unknown` on the shared `Db` type.
  - `listExercises(db, f: { pattern?: Pattern; search?: string }): ExerciseListItem[]`.
  - `getExercise(db, id): ExerciseDetail | null`.
  - `countExercises(db): number`.
  - `countByPattern(db): Record<Pattern, number>`.

- [ ] **Step 1: Write the failing catalogue tests.**
  - The lists are exactly spec section 5: categories KD, HD, Push, Pull, Core; training types Strength, Plyometric, Power, Cardio; the 10 patterns, including `none`.
  - There are 12 muscles, and `muscleName('upper back')` is `{ en: 'Upper back', pl: 'mięśnie górnej części pleców' }`.

  The Polish names are copied from `MUSCLE_NAMES` in `legacy/gym_tracker.py`.
- [ ] **Step 2: Write the failing data tests:**
  - `seedExercises(db, SEED_EXERCISES)` returns 23. A second call returns 0.
  - A custom "back squat" inserted before seeding is kept, and the seed's "Back squat" is skipped.
  - "Underhand pull-up" and "Overhand pull-up" have `uses_bodyweight = 1`; every other seed exercise has 0.
  - `listExercises({ search: 'przysiad' })` finds "Back squat" and "Bulgarian split squat".
  - `listExercises({ pattern: 'KD' })` returns only KD exercises.
- [ ] **Step 3: Write `data/seed/exercises.ts`.** Convert the 23 rows of `legacy/data/exercises.csv` with a one-off script that isn't committed. That file is git-ignored and exists only in the owner's working copy, which this session uses. The committed TypeScript file is the source of truth from then on. Category "Knee dominant" becomes `KD`, and "Hip dominant" becomes `HD`.
- [ ] **Step 4: Implement the catalogue and the repository.** Search is a case-insensitive substring match on `name_en` or `name_pl`, after trimming. Fold case in JavaScript (`toLocaleLowerCase('pl')`), not with SQL `lower()`, which folds ASCII only, so "Ż" and "Ł" would not match. Add a test: `search: 'ŁYDKI'` matches an exercise whose Polish name contains "łydki". Run the tests. Expected: PASS.
- [ ] **Step 5: Write the failing screen test, then build the library screens.**
  - Test: the list shows "Back squat" with the subtitle "Przysiad ze sztangą · Knee Dominant", and a bodyweight exercise shows "BW". Tapping a row opens the detail screen, which shows "Uses body weight".
  - Screens: search, pattern chips and "+ Add exercise" (which goes to the Task 5 route).
- [ ] **Step 6: Run** `npm run lint && npm run typecheck && npx jest`. **Commit.** PR `feat(exercises): GYM-17 Exercise catalogue and seed data`.

### Task 5: Add exercise page (GYM-29)

**Files:**
- Create: `app/library/add.tsx`
- Modify: `data/exercises.ts`
- Test: `data/__tests__/exercises.test.ts`, `app/__tests__/addExercise.test.tsx`
- **Board:** `library/add exercise`.

**Interfaces:**
- Produces:
  - `type NewExercise = { nameEn; namePl?; category; trainingType; pattern; usesBodyweight; muscles: Muscle[] }`.
  - `addCustomExercise(db: DbOrTx, e: NewExercise): string` throws `DuplicateNameError` (exported). It checks duplicates in JavaScript with locale case folding first. The `lower(name_en)` index is the backstop.
  - The route `/library/add` accepts the query `?returnTo=session&sessionId=<id>`. Task 7 uses it to choose the new exercise.

- [ ] **Step 1: Write the failing tests:**
  - `addCustomExercise({ nameEn: '  dips ' })` saves `"dips"` (trimmed) with `is_custom = 1`.
  - A second `"Dips"` throws `DuplicateNameError`.
  - `"bench PRESS"` (the seed has "Bench press") throws.
  - Screen: "Save exercise" stays disabled until the English name, category, training type and pattern are set. A duplicate shows "An exercise with this name already exists".
- [ ] **Step 2: Implement.** Run `npm run lint && npm run typecheck && npx jest`. Expected: PASS.
- [ ] **Step 3: Commit.** PR `feat(exercises): GYM-29 Add exercise page`.

### Task 6: Client profile, edit, archive and body-weight history (new ticket, created in Task 3)

**Files:**
- Create:
  - `data/measurements.ts`
  - `app/clients/[id]/index.tsx` (client screen: Profile and "Start session")
  - `app/clients/[id]/weight/index.tsx`, `app/clients/[id]/weight/add.tsx`, `app/clients/[id]/weight/[mid].tsx`
- Modify: `data/clients.ts`, `domain/clients.ts`
- Test:
  - `data/__tests__/measurements.test.ts`
  - `data/__tests__/clients.test.ts`
  - `app/__tests__/profile.test.tsx`, `app/__tests__/weight.test.tsx`
- **Boards:**
  - `client/profile`, `client/profile - me`, `client/dialog - archive`
  - `weight/history`, `weight/add`, `weight/edit`, `weight/dialog - replace`, `weight/dialog - delete`

**Interfaces:**
- Produces:
  - `getClient(db, id): ClientRow | null`, `updateClient(db, id, patch: Partial<NewClient>): void` and `archiveClient(db, id): void`. Archiving "Me" throws `CannotArchiveSelfError`.
  - `listWeights(db, clientId): WeightRow[]`, newest date first.
  - `addWeight(db, clientId, date, kg, opts: { replace: boolean }): 'saved' | 'conflict'`.
  - `updateWeight(db, id, v: { date: string; kg: number }, opts: { replace: boolean }): 'saved' | 'conflict'`.
  - `deleteWeight(db, id): void` throws `LastWeightError`.
  - `latestWeight(db, clientId): WeightRow`.

- [ ] **Step 1: Write the failing data tests:**
  - `addWeight` on a date that already has a weight returns `'conflict'` and changes nothing. With `{ replace: true }` it overwrites, so there is still one row.
  - `updateWeight` that moves an entry onto another entry's date returns `'conflict'`. With `replace`, the other entry is removed and this one moves.
  - `deleteWeight` on the only entry throws `LastWeightError`.
  - `archiveClient(me)` throws.
  - An archived client keeps its weights.
- [ ] **Step 2: Write the failing screen tests:**
  - With date of birth `1992-03-15` and today `2026-11-11`, the profile shows "34 years" and the latest weight.
  - "Me" has no Archive button.
  - For another client, Archive opens the `client/dialog - archive` dialog. Confirming it removes the client from the Clients list.
  - Adding a weight on an existing date shows "Replace the weight for this date?".
  - Deleting shows "Delete this weight entry?" with "64.2 kg · 27 Oct 2026". On the last entry, Delete is hidden.
- [ ] **Step 3: Implement.** Profile editing reuses the `clients/add` form, filled in, with "Save" (the GYM-18 default). Run the full checks. Expected: PASS.
- [ ] **Step 4: Commit.** PR `feat(clients): GYM-<n> Client profile, edit, archive and body-weight history`, using the real key of the ticket created in Task 3. Cite PR #21, decision 7, for the client screen without tabs. If the owner hasn't seen that screen yet, label the PR `needs-owner`. Update `docs/design/README.md` so the profile and weight boards map to the new ticket instead of GYM-18.

### Task 7: Start a session, choose an exercise and "Last time" (GYM-19)

**Files:**
- Create:
  - `domain/sets.ts` (formatting)
  - `data/sessions.ts`
  - `app/session/start.tsx` (date)
  - `app/session/[id]/index.tsx` (session page, empty state)
  - `app/session/[id]/patterns.tsx`, `app/session/[id]/pattern/[pattern].tsx`, `app/session/[id]/search.tsx`
- Modify: `app/clients/[id]/index.tsx` ("Start session")
- Test:
  - `domain/__tests__/sets.test.ts`
  - `data/__tests__/sessions.test.ts`
  - `app/__tests__/chooseExercise.test.tsx`
- **Boards:**
  - `client/overview`
  - `log/start - date`, `log/session - empty`
  - `log/choose - patterns`, `log/choose - pattern exercises`, `log/choose - search`, `log/choose - search no results`
  - `log/exercise - first time`, `log/exercise - last time`

**Interfaces:**
- Produces:
  - `type SetValue = { weightKg: number | null; reps: number | null }`.
  - `formatKg(n: number): string`: `62.5` becomes `"62.5"`, and `60` becomes `"60"`.
  - `formatSet(s: SetValue, usesBodyweight: boolean): string`.
  - `formatLastTime(sets: SetValue[] | null, usesBodyweight: boolean): string` returns "First time" for `null`.
  - `getDraft(db): DraftInfo | null`, where `DraftInfo = { sessionId; clientId; clientName: string; exerciseCount: number }`.
  - `startSession(db, clientId, date): string` throws `DraftExistsError` when any draft exists.
  - `addExerciseToSession(db, sessionId, exerciseId): string` returns the session-exercise id, with `position` = max + 1.
  - `lastTimeSets(db, clientId, exerciseId): SetValue[] | null`.

- [ ] **Step 1: Write the failing `sets` tests:**

  ```ts
  expect(formatSet({ weightKg: 60, reps: 8 }, false)).toBe('60 kg × 8');
  expect(formatSet({ weightKg: null, reps: 10 }, false)).toBe('- × 10');
  expect(formatSet({ weightKg: 62.5, reps: null }, false)).toBe('62.5 kg × -');
  expect(formatSet({ weightKg: 10, reps: 6 }, true)).toBe('BW + 10 kg × 6');
  expect(formatSet({ weightKg: null, reps: 8 }, true)).toBe('BW × 8');
  expect(formatLastTime([{ weightKg: 60, reps: 8 }, { weightKg: 62.5, reps: 6 }], false))
    .toBe('Last time: 60 kg × 8, 62.5 kg × 6');
  expect(formatLastTime(null, false)).toBe('First time');
  ```

- [ ] **Step 2: Write the failing data tests:**
  - `startSession` while another client has a draft throws `DraftExistsError`.
  - `lastTimeSets` returns the sets of the latest **finished** session by `date` (then `finished_at`), in set order. Test cases:
    - a session back-dated to before an older one;
    - a draft that has the exercise is ignored;
    - another client's session is ignored;
    - no history returns `null`;
    - the latest finished session has the exercise but **no sets**: it returns `[]`, and the screen shows "First time". So `formatLastTime([])` also returns "First time".
- [ ] **Step 3: Write the failing screen test.**
  - Choose by pattern: Knee Dominant → Back squat. The exercise screen shows "Back squat" and "Przysiad ze sztangą". With history it shows "Last time: …", and without it "First time".
  - Search "xyz" shows the no-results state.
  - The "New exercise" row goes to `/library/add?returnTo=session&sessionId=…`. After saving, that exercise is added to the session.
- [ ] **Step 4: Implement.** Run the full checks. Expected: PASS.
- [ ] **Step 5: Commit.** PR `feat(log): GYM-19 Log session: choose exercise and last time`. Cite PR #21, decision 7, for the client screen.

### Task 8: Add, edit and delete sets; kg | %; body weight (GYM-20)

**Files:**
- Create:
  - `domain/progress.ts` (the % part only)
  - `domain/bodyweight.ts`
  - `app/session/[id]/exercise/[seId].tsx`
- Modify: `domain/sets.ts`, `data/sessions.ts`
- Test:
  - `domain/__tests__/sets.test.ts`, `domain/__tests__/progress.test.ts`, `domain/__tests__/bodyweight.test.ts`
  - `data/__tests__/sessions.test.ts`
  - `app/__tests__/logSets.test.tsx`
- **Boards:**
  - `log/exercise - last time`, `log/exercise - editing set`, `log/exercise - after delete`, `log/exercise - blank values`
  - `log/exercise - percent mode`, `log/exercise - bodyweight`, `log/exercise - percent unavailable`

**Interfaces:**
- Produces:
  - `parseWeight(text: string): number | null | 'invalid'` and `parseReps(text: string): number | null | 'invalid'`.
  - `nextSetNo(existing: number[]): number`.
  - `percentToKg(oneRmKg: number, percent: number): number`.
  - `addedLoadFromPercent(oneRmKg: number, percent: number, bodyWeightKg: number): number`.
  - `bodyWeightOn(entries: { date: string; valueKg: number }[], date: string): { valueKg: number; date: string } | null`. It returns the entry, so the screen can show "Body weight 82 kg (7 Nov)" with `formatDayMonth`.
  - `addSet(db, seId, v: SetValue): string`, `updateSet(db, setId, v: SetValue): void` and `deleteSet(db, setId): void`.
  - `finishExercise(db, seId): void` and `reopenExercise(db, seId): void`.
  - `currentOneRepMax(db, clientId, exerciseId): number | null`, the newest `one_rep_maxes` row by `created_at`.
  - `exerciseScreenData(db, seId): { exercise: { id: string; nameEn: string; namePl: string | null; usesBodyweight: boolean }; sets: { id: string; setNo: number; weightKg: number | null; reps: number | null }[]; oneRepMaxKg: number | null; bodyWeight: { valueKg: number; date: string } | null; lastTime: SetValue[] | null }`.

- [ ] **Step 1: Write the failing domain tests:**
  - **`parseWeight`:**

    | Input | Result |
    |---|---|
    | `'22,5'`, `'22.5'` | `22.5` |
    | `',5'` | `0.5` |
    | `''`, `'  '` | `null` |
    | `'22,,5'`, `'-5'`, `'1e3'`, `'abc'` | `'invalid'` |

  - **`parseReps`:** `'8'` → `8`; `' 8 '` → `8`; `'0'`, `'8.5'`, `'-1'` → `'invalid'` (a set needs at least 1 rep, as in `gym_tracker.py`); `''` → `null`.
  - **`parseWeight`:** `' 22,5 '` → `22.5` (padding is trimmed); `'22.'` → `22`; `'.5'` → `0.5`; `'0'` → `0` (a set with no load).
  - **`nextSetNo`:** `[1, 3, 4]` → `5`; `[]` → `1`.
  - **`percentToKg(60, 85)`** → `51`. `percentToKg(101.75, 80)` → `81`.
  - **`addedLoadFromPercent`:** `(99, 80, 82)` → `-2.8`, rounded to `-3`, clamped to `0`. `(120, 85, 82)` → `20`. `(101, 85, 82.4)` → `3`, because 85.85 − 82.4 = 3.45 rounds to 3. Rounding the total first would give 86 − 82.4 = 3.6 → 4, so this case pins the order: subtract the unrounded total, then round.
  - **`bodyWeightOn`:** with entries `[{ '2026-10-01', 80 }, { '2026-11-01', 82 }]`:
    - `'2026-10-15'` → `{ valueKg: 80, date: '2026-10-01' }`;
    - `'2026-09-01'` → `{ valueKg: 80, date: '2026-10-01' }` (before the first entry, the earliest one is used);
    - `'2026-11-05'` → `{ valueKg: 82, date: '2026-11-01' }`;
    - `[]` → `null`.
- [ ] **Step 2: Write the failing data tests:**
  - Sets 1, 2, 3, 4: delete 2, then `addSet` creates set 5, and the numbers left are 1, 3, 4, 5.
  - `addSet` with `{ weightKg: null, reps: null }` saves NULLs.
  - `currentOneRepMax` returns the newest row.
- [ ] **Step 3: Write the failing screen test.**
  - Typing `22,5` and `8` and tapping "Add set" adds the row "22.5 kg × 8".
  - The % chip is disabled with "Set a 1RM in Progress to use %" when there's no 1RM.
  - With a 1RM of 60, "85" in % mode saves 51 kg.
  - On a bodyweight exercise for a client whose weight entry is 82 kg on `2026-11-07`, in a session on or after that date: a set shows "BW + 10 kg × 6", and the line "Body weight 82 kg (7 Nov) is added to the load." shows.
  - Tapping a logged set opens it for editing. Changing its reps to 10 and saving updates the row.
  - "Finish exercise" goes back to the session page.
- [ ] **Step 4: Implement.** The kg | % choice is screen state, kept for the rest of that exercise in this session (the spec allows memory only). Run the full checks. Expected: PASS.
- [ ] **Step 5: Commit.** PR `feat(log): GYM-20 Log session: add, edit and delete sets`.

### Task 9: Finish, cancel, reorder, one-draft rule and the Home draft bar (GYM-21)

**Files:**
- Modify:
  - `data/sessions.ts`
  - `app/session/[id]/index.tsx`
  - `app/index.tsx` (the bar)
  - `app/clients/[id]/index.tsx` (the draft prompt)
- Create: `app/session/[id]/reorder.tsx`
- Test: `data/__tests__/sessions.test.ts`, `app/__tests__/session.test.tsx`, `app/__tests__/home.test.tsx`
- **Boards:**
  - `log/session - with exercises`, `log/session - reorder`
  - `log/dialog - remove exercise`, `log/dialog - discard session`, `log/dialog - draft exists`, `log/dialog - draft exists (empty)`
  - `home - session in progress`, `client/overview - draft exists`

**Interfaces:**
- Produces:
  - `finishSession(db, id): void` throws `NoExercisesError`.
  - `discardSession(db, id): void`.
  - `moveExercise(db, seId, dir: 'up' | 'down'): void`.
  - `removeExercise(db, seId): void`.
  - `resumePoint(db, sessionId): { screen: 'exercise'; seId: string } | { screen: 'session' }`.

- [ ] **Step 1: Write the failing data tests:**
  - `finishSession` with no exercises throws. With one exercise it sets `status = 'finished'` and `finished_at`, and `getDraft` becomes `null`.
  - `moveExercise` up on the first exercise, or down on the last, changes nothing. Otherwise positions swap. It also works after removing a middle exercise, which leaves a gap in the positions: it swaps with the neighbour, not with `position ± 1`.
  - `removeExercise` deletes its sets.
  - `discardSession` deletes everything.
  - `resumePoint` returns `'exercise'` for an exercise without `finished_at`, and `'session'` when every exercise is finished.
- [ ] **Step 2: Write the failing screen tests:**
  - Home with a draft shows "Session in progress: Anna Kowalska". Tapping it opens the `resumePoint` route.
  - "Start session" for any client while a draft exists shows "A session is already in progress" with "Resume", "Finish it" and "Discard it". For a draft with no exercises, it shows only "Resume" and "Discard it".
  - "Discard it" asks "Discard this session?", then continues to Start session (the spec, not the prototype shortcut).
  - "Finish session" is disabled until the session has an exercise.
  - "Remove" asks "Remove this exercise and its sets?".
  - Tapping a finished exercise reopens it: it shows its sets, and adding another set works.
- [ ] **Step 3: Implement.** Run the full checks. Expected: PASS.
- [ ] **Step 4: Commit.** PR `feat(log): GYM-21 Log session: finish, cancel, reorder and one-draft rule`.

### Task 10: Sprint 1 review on the phone

**Files:** none (Jira only).

- [ ] **Step 1:** Ask the owner to run the `build-android.yml` workflow with the `preview` profile. Claude never runs EAS builds.
- [ ] **Step 2:** The owner installs the APK and logs one real session. They check:
  - Welcome;
  - Home;
  - adding a client;
  - the session itself;
  - closing the app mid-session and resuming from the Home bar.

  % mode can't be tried yet: setting a 1RM arrives with GYM-24 in Sprint 2, so the % chip shows "Set a 1RM in Progress to use %". Body-weight exercises can be tried.
- [ ] **Step 3:** Record the findings as tickets. Comment the sprint summary on GYM-3, then write the Sprint 2 plan.
