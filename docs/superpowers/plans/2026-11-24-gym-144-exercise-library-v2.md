# GYM-144 / GYM-149 Exercise Library v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 23-exercise library with the owner's 831-exercise library: a new data model (5 patterns, subcategory, equipment, primary and secondary muscles, aliases, importance), a one-time upgrade of existing phones, and the 8 approved Penpot boards.

**Architecture:**
- **Schema:** one Drizzle migration (`0001`) changes the schema only.
- **Library upgrade:** a separate, idempotent JS step at start-up (`syncLibrary`) maps old exercises to the new library by name or alias and keeps their ids. It drops unmatched exercises with their history once, then inserts the rest.
- **Pure parts:** the matching logic and the fixed lists live in `domain/`; the seed is a committed JSON generated from `local-data/main-exercise-db.json`.

**Tech Stack:** Expo SDK 58, TypeScript, Drizzle and expo-sqlite (better-sqlite3 in Jest), Jest with RNTL. **No new libraries:** the dropdowns are React Native `Modal`s, and the long list is RN `FlatList`.

**Spec:** `docs/superpowers/specs/2026-10-28-gym-assist-app-design.md` (sections 5 and 6). The owner decisions are in Jira:
- GYM-144: comments 10147 and 10149 (muscles, equipment);
- GYM-149: comments 10151–10165 (patterns, screens, upgrade rules, design review).

GYM-149 replaces the 15-pattern list and the mapping table in GYM-144.

## Global Constraints

- **Patterns, stored codes and display names:**
  - `KD` "Knee dominant", `HD` "Hip dominant", `Push`, `Pull`, `Core`;
  - always in this order;
  - cardio has `pattern = null` and is shown as "Cardio" (search only, never in Choose by pattern or Recovery).
- **Subcategory codes:**
  - Push and Pull: `vertical`, `horizontal`;
  - Core: `anti-extension`, `anti-rotation`, `carry`;
  - otherwise null;
  - display names: "Vertical", "Horizontal", "Anti-extension", "Anti-rotation", "Carry", and "Other" for null.
- **Equipment (one per exercise, required):** `barbell`, `dumbbell`, `kettlebell`, `machine`, `cable`, `bodyweight`, `band`, `other`. Displayed capitalised ("Barbell").
- **Muscles (16):**
  - the 12 existing muscles, plus `forearms`, `lower back`, `traps`, `abductors`;
  - each has an English and a Polish name.
- **Roles:** `primary` and `secondary`. Only primary muscles count for Recovery.
- **Importance:** integer 1–4, where 1 shows first. Every list sorts by importance, then English name (`localeCompare(…, 'en')`). An exercise added through Add exercise always gets importance 1.
- **Mechanic and level:** stored (nullable) but not shown or asked. `Uses body weight` is stored, asked on Add, and not shown on the detail screen.
- **Ids:** an existing exercise matched by name or alias keeps its id. History and 1RMs stay linked.
- **Unmatched exercises:** a custom exercise that matches no library name or alias is deleted at the upgrade, together with its session exercises, sets and 1RMs. A session left with no exercises is deleted. This happens **once** (library version 1 → 2), never on later starts.
- **Names:** unique ignoring case across English names **and** aliases (`foldName`, JS-side). The import, search and duplicate check all include aliases.
- **Copy (verbatim):**
  - row lines: "Polish · Pattern · Equipment" in the library, "Polish · Equipment · Primary muscles" in the choose lists;
  - alias hit: "· also: <alias>";
  - detail rows: "Training type", "Pattern", "Equipment", "Primary muscles", "Secondary muscles", "Sides" ("Unilateral" or "Bilateral"), "Level";
  - footnote on Add: "* required · Primary muscles: pick one or more · Subcategory only for Push, Pull and Core · no pattern for Cardio".
- **Personal data:** never commit `local-data/`, and never commit the owner's backup. The seed JSON contains library data only.
- **Licences:** a `THIRD_PARTY_NOTICES.md` at the repo root holds the full MIT notice of the coach plugin (copy it from the plugin's own `LICENSE`, found under `~/.claude/plugins`) and the free-exercise-db Unlicense note.

## Decisions for the owner (in the PR, `needs-owner`)

1. **Drop the hidden `category` column.** With 5 patterns it is identical to the pattern (GYM-99 kept it "for later use"; that later use is now the pattern itself).
2. **Retire the Recovery golden test** against `legacy/gym_tracker.py`. The Python tool knows the old 9 patterns and counts every muscle, so it can't check the new rules any more. The thresholds keep their unit tests, and the new rules get explicit tests. The change is recorded in the engineering log.
3. **The library upgrade runs in app code at start-up, not inside the SQL migration**, because matching by aliases with Polish case folding needs JS. It is keyed by an `app_settings` row `library.version = '2'`. It runs in one transaction, after the pre-migration snapshot, so a failure rolls back and the snapshot still exists.

## Review Focus

1. **A custom exercise the owner created that happens to match a library name or alias** (for example "Push-up"): it is mapped in place, keeps its id and history, and becomes built-in (`is_custom = 0`). It is not deleted.
2. **A draft session in progress during the upgrade:** it is deleted only if all of its exercises were dropped. A draft that keeps one exercise survives with its sets.
3. **The second start after the upgrade:** nothing is deleted or rewritten. A custom exercise added after the upgrade survives every later start.
4. **Search for a Polish name with diacritics in a different case** ("PRZYSIAD", "ław"): it matches, because folding happens in JS, not SQLite.
5. **Add exercise with Training type Cardio after choosing a pattern:** the pattern and subcategory are cleared and not saved. Changing the pattern from Push to Core clears a now-invalid subcategory.

---

### Task 1: Domain catalogue v2

**Files:**
- Modify: `domain/catalogue.ts` (rewrite the lists)
- Test: `domain/__tests__/catalogue.test.ts`

**Interfaces (Produces):**
- **Lists:**
  - `PATTERNS = ['KD','HD','Push','Pull','Core'] as const`, `type Pattern`;
  - `SUBCATEGORIES: Record<Pattern, readonly Subcategory[]>` (KD and HD map to `[]`), `type Subcategory`;
  - `TRAINING_TYPES` (unchanged), `EQUIPMENT` (8), `type Equipment`;
  - `LEVELS = ['beginner','intermediate','advanced']`, `MECHANICS = ['compound','isolation']`;
  - `MUSCLES` (16), `type Muscle`.
- **Display names:**
  - `patternName(p: Pattern | null): string`, where null gives "Cardio";
  - `subcategoryName(s: Subcategory | null): string`, where null gives "Other";
  - `equipmentName(e: Equipment): string`;
  - `muscleName(m)` (unchanged shape);
  - `muscleList(muscles)` (unchanged).
- **Row text:**
  - `libraryRowText(e: {namePl; pattern; equipment}): string`;
  - `chooseRowText(e: {namePl; equipment; primaryMuscles; matchedAlias?: string | null}): string`.
- **Removed:** `CATEGORIES`, `categoryForPattern`, `displayName`, `exerciseSubtitle`. The compiler lists every caller, and Tasks 5–7 replace them.

- [ ] **Step 1: Write the failing tests**
  - `PATTERNS` equals `['KD','HD','Push','Pull','Core']`;
  - `patternName('KD') === 'Knee dominant'` and `patternName(null) === 'Cardio'`;
  - `SUBCATEGORIES.Core` equals `['anti-extension','anti-rotation','carry']` and `SUBCATEGORIES.KD` equals `[]`;
  - `MUSCLES.length === 16`, and every muscle has a non-empty `pl`;
  - `libraryRowText({namePl:'Przysiad ze sztangą', pattern:'KD', equipment:'barbell'}) === 'Przysiad ze sztangą · Knee dominant · Barbell'`;
  - the same with `pattern: null` gives `'… · Cardio · …'`;
  - `chooseRowText({namePl:'Wyciskanie sztangi nad głowę', equipment:'barbell', primaryMuscles:['shoulders'], matchedAlias:'military press'}) === 'Wyciskanie sztangi nad głowę · Barbell · Shoulders · also: military press'`;
  - a null `namePl` is skipped, not printed as "null".
- [ ] **Step 2: Run** `npx jest domain/__tests__/catalogue.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** Polish names for the new muscles:
  - forearms: "mięśnie przedramienia";
  - lower back: "prostowniki grzbietu";
  - traps: "mięsień czworoboczny";
  - abductors: "mięśnie odwodziciele".
- [ ] **Step 4: Run.** Expected: PASS. (Other suites fail to compile until Tasks 3–7; run only this file.)
- [ ] **Step 5: Commit** `feat(exercises): GYM-147 catalogue v2: 5 patterns, subcategories, equipment, 16 muscles`

### Task 2: Seed generator and committed seed

**Files:**
- Create: `scripts/build-seed.mjs` (Node, no dependencies), `data/seed/exercises.json`, `THIRD_PARTY_NOTICES.md`
- Modify: `data/seed/exercises.ts` (types plus a typed re-export of the JSON; the old 23-entry array moves to `data/seed/__fixtures__/exercises-v1.ts` for the upgrade tests)
- Test: `data/__tests__/seed.test.ts`

**Interfaces (Produces):**
- `type SeedExercise = { nameEn; namePl; aliases: string[]; pattern: Pattern | null; subcategory: Subcategory | null; trainingType; equipment: Equipment; primaryMuscles: Muscle[]; secondaryMuscles: Muscle[]; mechanic: Mechanic | null; level: Level | null; unilateral: boolean; usesBodyweight: boolean; importance: 1|2|3|4 }`
- `SEED_EXERCISES: SeedExercise[]`
- `SEED_VERSION = 2`
- `V1_SEED_NAMES: string[]` (the 23 old English names, in the test fixture)

- [ ] **Step 1: Write the failing tests** on the committed JSON:
  - **counts:** 831 exercises; per pattern KD 160, HD 106, Push 251, Pull 203, Core 95, null 16;
  - **valid values:** every pattern, subcategory, equipment and muscle value is in the Task 1 lists; a subcategory is allowed by `SUBCATEGORIES[pattern]`;
  - **required content:** every exercise has a `namePl` and at least one primary muscle; no muscle is both primary and secondary;
  - **names:** the folded English names and aliases are all distinct across the whole seed;
  - **the old library maps cleanly:** every name in `V1_SEED_NAMES` except "Hip flexor variation with locked leg" matches exactly one seed entry by name or alias; the hip flexor matches none.
- [ ] **Step 2: Run** `npx jest data/__tests__/seed.test.ts`. Expected: FAIL (no JSON yet).
- [ ] **Step 3: Write `scripts/build-seed.mjs <path-to-main-exercise-db.json>`.** It maps:
  - `"Knee dominant"` → `KD`, `"Hip dominant"` → `HD`;
  - subcategories to lower-case codes (`"Anti-extension"` → `anti-extension`);
  - `important` → `importance`.

  It writes `data/seed/exercises.json` (2-space indent, keys in a fixed order, so diffs stay readable) and fails with a message on any unknown value. Write `THIRD_PARTY_NOTICES.md`.
- [ ] **Step 4: Run** `node scripts/build-seed.mjs local-data/main-exercise-db.json`, then the test. Expected: PASS. Check `git status`: `local-data/` doesn't appear.
- [ ] **Step 5: Commit** `feat(exercises): GYM-149 seed v2 generated from the owner's library (831 exercises)`

### Task 3: Schema migration 0001 and backup tables

**Files:**
- Modify: `data/schema.ts`, `data/backup.ts` (`BACKUP_TABLES` gains `exerciseAliases` after `exerciseMuscles`)
- Generate: `data/migrations/0001_*.sql`, `meta/0001_snapshot.json`, `_journal.json`, `migrations.js` (with `npx drizzle-kit generate`; never edit by hand except the comment header)
- Create: `data/testing/testDb.ts`: add `createTestDbAt(migrations: number): {db, sqlite, migrateRest(): void}`. It copies the first n journal entries into a temp folder, and `migrateRest` applies the full folder.
- Test: `data/__tests__/schema.test.ts`, `data/__tests__/backup.test.ts`, `data/__tests__/restore.test.ts`

**Schema changes:**
- **`exercises`:**
  - `pattern` becomes nullable;
  - drop `category`;
  - add `subcategory text`, `equipment text NOT NULL DEFAULT 'other'`, `mechanic text`, `level text`, `unilateral integer NOT NULL DEFAULT 0`, `importance integer NOT NULL DEFAULT 1`.
- **`exercise_muscles`:** add `role text NOT NULL DEFAULT 'primary'` (enum `primary` | `secondary`). The primary key stays `(exercise_id, muscle)`.
- **New `exercise_aliases`:** `exercise_id` (FK, cascade), `alias`, `updated_at`, with PK `(exercise_id, alias)` and a unique index on `lower(alias)`.

**Interfaces (Produces):** `exerciseAliases` table export; `SCHEMA_VERSION === 2`.

- [ ] **Step 1: Write the failing tests:**
  - **schema test:** the columns exist after migration; `pattern` accepts null; inserting two aliases "Bench press" and "bench press" fails with UNIQUE; deleting an exercise cascades its aliases;
  - **backup test:** `SCHEMA_VERSION === 2` and `BACKUP_TABLES` names include `exercise_aliases`;
  - **restore test:** a backup round trip keeps aliases and muscle roles;
  - **old data:** `createTestDbAt(1)` with a v1 exercise and sets, then `migrateRest()`, keeps the row, its id, its sets and `pattern = 'Push vertical'` (the upgrade in Task 4 re-tags it), with `equipment = 'other'`, and `PRAGMA foreign_key_check` is empty.
- [ ] **Step 2: Run** `npx jest data/__tests__/schema.test.ts data/__tests__/backup.test.ts data/__tests__/restore.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Edit `schema.ts`, run `npx drizzle-kit generate --name exercise_library_v2`, check the SQL rebuilds `exercises` with `INSERT INTO __new_exercises SELECT …` (data kept), and add `createTestDbAt`.
- [ ] **Step 4: Run** the three suites. Expected: PASS.
- [ ] **Step 5: Commit** `feat(db): GYM-147 migration 0001: exercise properties, muscle roles, aliases`

### Task 4: Library upgrade (pure plan + apply), replacing `seedExercises`

**Files:**
- Create: `domain/library.ts`, `data/library.ts`
- Modify: `data/db/open.ts` (`seedExercises(tx, SEED_EXERCISES)` becomes `syncLibrary(tx, SEED_EXERCISES)`), `data/exercises.ts` (remove `seedExercises`)
- Test: `domain/__tests__/library.test.ts`, `data/__tests__/library.test.ts`

**Interfaces (Produces):**
- `planLibraryUpgrade(existing: {id: string; nameEn: string; aliases: string[]}[], seed: {nameEn: string; aliases: string[]}[]): { map: {id: string; seedIndex: number}[]; drop: string[]; insert: number[] }`
  - pure;
  - matches the folded existing English name or alias against the folded seed English names and aliases;
  - a seed entry is used once, and a second existing row hitting the same entry is dropped (and listed);
  - `insert` holds the seed indexes not mapped.
- `syncLibrary(db: DbOrTx, seed: SeedExercise[]): { mapped: number; dropped: number; inserted: number; sessionsDeleted: number }`
  - **when `library.version` is missing or below `SEED_VERSION`:** run the plan; for each mapped row overwrite every property from the seed (`is_custom = 0`, muscles and aliases replaced, and the old English name added as an alias when it differs and is free); for dropped rows delete their 1RMs and session exercises (sets cascade), then delete sessions that had exercises removed and now have none, then the exercises; insert the rest; set `library.version`;
  - **otherwise:** insert only seed entries whose name or alias is not taken (today's behaviour), and never delete;
  - it lives in `data/` and calls the pure plan.

- [ ] **Step 1: Write the failing tests:**
  - **domain:**
    - "Bench press" maps to the seed entry whose aliases include "bench press";
    - "PRZYSIAD ZE SZTANGĄ"-style case differences match;
    - an unknown name lands in `drop`;
    - two existing rows hitting one seed entry: the first is mapped, the second dropped;
    - `insert` excludes mapped indexes.
  - **data**, each test using a v1 database from `createTestDbAt(1)` plus `migrateRest()`, filled from `V1_SEED_NAMES` via raw inserts, a client and history from `logSession`:
    - after `syncLibrary`, each of the 22 mapped exercises keeps its id and gets the seed's English name, its old name is an alias, `countExercises === 831`, and its sets and 1RMs are intact;
    - the hip flexor and a custom "My drill" are gone with their sets and 1RMs, a session that only had them is gone, and a session with one other exercise remains;
    - a draft session holding only "My drill" is deleted, and a draft holding "Back squat" too survives;
    - a custom "Push-Up" (a library name) is mapped, keeps its id and gets `isCustom === false`;
    - running `syncLibrary` a second time returns `{mapped:0, dropped:0, inserted:0, sessionsDeleted:0}`, and a custom exercise added between the two runs survives;
    - a fresh `createTestDb()` gives `inserted: 831`, and `library.version` is `'2'`;
    - `PRAGMA foreign_key_check` is empty after the upgrade.
- [ ] **Step 2: Run** `npx jest domain/__tests__/library.test.ts data/__tests__/library.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** Insert in chunks of 100 (SQLite's variable limit, as in `restore.ts`).
- [ ] **Step 4: Run.** Expected: PASS. Then `npx jest data` (exercise tests that relied on `seedExercises` switch to `syncLibrary`).
- [ ] **Step 5: Commit** `feat(db): GYM-149 one-time library upgrade: map by name or alias, keep ids, drop unmatched`

### Task 5: Reads, writes, import and Recovery on the new model

**Files:**
- Modify: `data/exercises.ts`, `data/import.ts`, `app/settings/import.tsx` (known names come from `allExerciseNames`), `data/recovery.ts`, `domain/recovery.ts`
- Delete: `tests/golden/make_recovery_golden.py`, `domain/__tests__/fixtures/recovery-golden.json` (Decision 2)
- Test: `data/__tests__/exercises.test.ts`, `data/__tests__/import.test.ts`, `data/__tests__/recovery.test.ts`, `domain/__tests__/recovery.test.ts`

**Interfaces (Produces):**
- **`ExerciseListItem = { id; nameEn; namePl; pattern: Pattern | null; subcategory: Subcategory | null; equipment: Equipment; primaryMuscles: Muscle[]; importance: number; usesBodyweight: boolean; isCustom: boolean; matchedAlias: string | null }`**
- **`listExercises(db, f: { pattern?: Pattern; subcategory?: Subcategory | 'other'; search?: string }): ExerciseListItem[]`**
  - **search** matches the folded English name, Polish name and aliases (substring);
  - **`matchedAlias`** is set only when no English or Polish name matched;
  - **order:** with a search, entries with a name starting with the text first, then importance, then English name; without one, importance, then English name;
  - **queries:** three, then the rest in JS.
- **`ExerciseDetail = ExerciseListItem & { trainingType; secondaryMuscles: Muscle[]; unilateral: boolean; level: Level | null; aliases: string[] }`**, and `getExercise(db, id): ExerciseDetail | null`
- **`countByPattern(db): Record<Pattern, number>`** (5 keys; cardio not counted)
- **`NewExercise = { nameEn; namePl?; trainingType; pattern: Pattern | null; subcategory: Subcategory | null; equipment: Equipment; primaryMuscles: Muscle[]; unilateral: boolean; usesBodyweight: boolean }`**
- **`addCustomExercise(db, e): string`**
  - **checks:** throws `DuplicateNameError` when the name equals any English name or alias; throws `Error` when `primaryMuscles` is empty, when the training type isn't Cardio and the pattern is null, or when the subcategory isn't allowed for the pattern;
  - **saves:** importance 1, `is_custom = 1`, all muscles with role `primary`;
  - for Cardio it stores pattern and subcategory as null.
- **`allExerciseNames(db): string[]`** (English names plus aliases)
- **Import:** `importHistory` resolves `exerciseEn` through English names and aliases.
- **Recovery:** `Trained = { date; pattern: Pattern | null; muscles: Muscle[] }`. `trainedFor` returns primary muscles only. `recoveryTable` gives 5 pattern rows (null patterns are skipped) and 16 muscle rows.

- [ ] **Step 1: Write the failing tests:**
  - **search and order:**
    - "military" returns Overhead Press first, with `matchedAlias: 'military press'`, then the rest ordered by importance;
    - "ław" and "ŁAW" return the same list;
    - `listExercises(db, {pattern:'Push', subcategory:'other'})` returns only Push rows with a null subcategory;
    - `listExercises(db, {})` starts with importance-1 exercises in A–Z order, and cardio rows are included;
  - **add exercise:**
    - "bench press" (an alias) throws `DuplicateNameError`;
    - a Cardio exercise saves with null pattern and subcategory;
    - an empty primary-muscle list throws;
    - the saved row has importance 1;
  - **import:** a CSV row named "Bench press" imports into the exercise now called "Barbell Bench Press - Medium Grip";
  - **recovery:**
    - a bench press session refreshes `chest` but leaves `triceps` "never logged";
    - a treadmill (cardio) session counts for its muscles and no pattern;
    - `recoveryTable([], today).patterns.map(r=>r.key)` equals `['KD','HD','Push','Pull','Core']`;
    - the threshold tests stay as they are.
- [ ] **Step 2: Run** `npx jest data domain`. Expected: the new tests FAIL.
- [ ] **Step 3: Implement.** Delete the golden files and the golden test case.
- [ ] **Step 4: Run** `npx jest data domain` and `npx tsc --noEmit -p .`. Expected: PASS; the remaining type errors are only in `app/` (Task 7).
- [ ] **Step 5: Commit** `feat(exercises): GYM-147 alias-aware search, import and duplicates; Recovery on 5 patterns, primary muscles`

### Task 6: Dropdown components

**Files:**
- Create: `ui/Select.tsx`, `ui/MultiSelect.tsx`
- Test: `tests/app/select.test.tsx`

**Interfaces (Produces):**
- `Select<T extends string>({ label, options: {value: T; label: string}[], value: T | null, onChange(v: T | null), placeholder? })`
  - the field looks like `TextField` (board `library / add exercise`), with a chevron;
  - a tap opens a `Modal` list with role `radio` items;
  - choosing closes it.
- `MultiSelect<T>({ label, options, value: T[], onChange(v: T[]) })`
  - the field shows the labels joined with ", ";
  - the bottom sheet (board `library / add exercise - muscles open`) shows a heading with the label, the hint "Pick one or more", checkbox items in two columns, and a "Done (n)" button;
  - changes apply only when Done is pressed; the backdrop or the back button cancels.
- Both use `useTapGuard` on the field and are accessible: the field has role `button` with the label and value as its name, and the items have `accessibilityState.checked`.

- [ ] **Step 1: Write the failing tests:**
  - **Select:** open, choose "Barbell", `onChange` gets `'barbell'` and the list closes;
  - **MultiSelect:**
    - open, tick Chest and Shoulders, the button reads "Done (2)", press it, and `onChange` gets `['chest','shoulders']` in tap order;
    - opening again and closing through the backdrop calls nothing;
  - **accessibility:** the field's accessible name includes the current value.
- [ ] **Step 2: Run** `npx jest tests/app/select.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement** with RN `Modal`, `Pressable` and `theme` tokens.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(exercises): GYM-148 Select and MultiSelect dropdowns`

### Task 7: Screens

**Files:**
- Modify:
  - `app/library/index.tsx` (FlatList with `scroll={false}`, chips All plus 5, `libraryRowText`);
  - `app/library/[id].tsx` (the detail rows; empty rows hidden);
  - `app/library/add.tsx` (Select and MultiSelect; the subcategory field only for Push, Pull or Core; the pattern hidden for Cardio; footnote copy);
  - `app/session/[id]/patterns.tsx` (5 rows via `patternName`);
  - `app/session/[id]/pattern/[pattern].tsx` (subcategory chips, first selected, none for KD and HD; a search field; FlatList; `chooseRowText`);
  - `app/session/[id]/search.tsx` (`chooseRowText` with `matchedAlias`; FlatList);
  - `app/clients/[id]/recovery.tsx` (`patternName`).
- Test: `tests/app/library.test.tsx`, `add-exercise.test.tsx`, `choose-exercise.test.tsx`, `recovery.test.tsx`, `session-flow.test.tsx`

- [ ] **Step 1: Write the failing tests** (screens render against a `createTestDb()` already synced with the seed):
  - **library:**
    - the first row is an importance-1 exercise;
    - tapping the "Core" chip shows only Core rows;
    - typing "bench press" shows "Barbell Bench Press - Medium Grip";
  - **detail:** the Bench press detail shows "Push · Horizontal" under "Pattern", "Chest" under "Primary muscles" and "Bilateral" under "Sides", and shows no "Level" row for an exercise without a level;
  - **add exercise:**
    - Save stays disabled until the name, training type, pattern, equipment and at least one primary muscle are set;
    - choosing Pattern "Push" shows Subcategory, and choosing "KD" hides it and clears it;
    - Training type "Cardio" hides Pattern;
    - the saved exercise appears first in the library (importance 1);
  - **choose by pattern:** 5 rows with counts "160 exercises", "106 exercises", "251 exercises", "203 exercises", "95 exercises";
  - **pattern exercises:**
    - Push shows the chips Vertical, Horizontal and Other with Vertical selected, and every row is a vertical Push exercise;
    - tapping Horizontal switches the list;
    - KD shows no chips;
    - search "press" filters within the selected chip;
  - **search:** "military" shows 6 rows, and the Overhead Press row ends with "also: military press";
  - **recovery:** the pattern rows read Knee dominant, Hip dominant, Push, Pull, Core.
- [ ] **Step 2: Run** `npx jest tests/app`. Expected: the new tests FAIL.
- [ ] **Step 3: Implement** to the Penpot boards (file "Gym Assist UX", pages "Other screens" and "Log session").
- [ ] **Step 4: Run** `npm test`, `npx tsc --noEmit -p .` and `npm run lint`. Expected: all green.
- [ ] **Step 5: Commit** `feat(exercises): GYM-148 screens for the 831-exercise library`

### Task 8: Docs, Jira and the pull request

**Files:**
- Modify:
  - spec section 2 (decisions), section 5 (catalogue, recovery rule, seed, library upgrade) and section 6 (data model: the new columns, `exercise_aliases`, `category` dropped);
  - `docs/engineering-log.md` (decisions: the library upgrade in JS keyed by version, the golden test retired, the recovery rule changed to primary muscles only; with the "what went wrong / what tests caught" notes from Tasks 1–7);
  - `CLAUDE.md` (Stage 2 line: "Exercise library" now 831 exercises with aliases; the patterns are the 5).

- [ ] **Step 1:** Update the docs, then run `npm test`, `npx tsc --noEmit -p .` and `npm run lint`.
- [ ] **Step 2:** Push and open the PR `feat(exercises): GYM-144 Exercise library v2: 831 exercises, 5 patterns, aliases`.
  - **Labels:** `needs-owner`.
  - **Body:** the ticket links (GYM-144, GYM-149), the changes, how they were tested, Decisions 1–3 in plain language, the note "after installing, an old backup can't be restored (intended); GYM-145 converts it", and Agent notes.
- [ ] **Step 3:** When CI is green: move GYM-144 to In Review and run the review subagent. Fix and re-review until it approves. Then wait for the owner's approval and squash-merge.
- [ ] **Step 4:** In Jira, move GYM-146, GYM-147, GYM-148, GYM-149 and GYM-144 to Done. GYM-145 (convert the owner's backup) becomes the next ticket.
