# Engineering log

Important decisions, incidents and bugs during development. Each entry links to its Jira ticket (project `GYM`) and pull request. Claude adds an entry at the end of every ticket that had a decision or an incident worth remembering, newest first in each section.

- **Decision:** a choice that shapes the code or the product, with the reason and the alternative we didn't take.
- **Incident:** something that went wrong (a bug, a broken build, a wrong claim, a process slip), how it was found, the fix, and the lesson.
- **Watch:** a known risk that a later ticket must handle.

Earlier work (Stage 0, Stage 1 and Sprint 1, PRs #1–#31) is recorded in each pull request's "Agent notes".

Links: Jira `https://jedrosz.atlassian.net/browse/GYM-<n>`, GitHub `https://github.com/jedrzejjan/gym-assist/pull/<n>`.

## Decisions

### 2026-11-13: The CSV import is all or nothing, and never doubles history (GYM-25, PR #42, plan decision 9)
- **Decision:** every row is checked before any write.
  - Unknown exercise names are all listed at once, so the trainer fixes them in one go.
  - The write is one `mutate`.
  - It refuses dates "Me" already has, rather than merging.
  - Without a "Me", Create my profile opens first, then the import continues.
  - Imported sessions get a finish time (noon UTC on their date), so "Last time" handles them like any other (GYM-25 watch item).
- **Why:** a half-imported or doubled history is worse than a refused file. The trainer can always fix the CSV and retry.
- **Alternative not taken:** merging or skipping taken dates. That's hard to explain, and it quietly hides a mistake.

### 2026-11-13: The automatic export fails safe (GYM-26, PR #40)
- **Decision:** `mutate` takes `{ export?: boolean }`, true unless the caller says otherwise. Only writes that change no finished data pass `false`: a draft, choosing the folder, saving the backup status.
- **Why:** a forgotten flag then costs one extra export, never a missing backup.
- **Guards:**
  - it never exports a database with no clients, so a fresh install can't overwrite a real backup with an empty one;
  - writes that arrive during an export give one more export, not one each;
  - saving the export's own status can't start another export.
- **Also:**
  - today's file is deleted and created again, rather than overwritten, because Android document providers don't always truncate a file;
  - rows are exported in `rowid` order for GYM-103.

### 2026-11-13: Ties on the stored 1RM go to the row saved last (GYM-24, PR #38)
- **Decision:** the current 1RM is the newest `one_rep_maxes` row by `created_at`. When two rows have the same timestamp, the one inserted last wins, using SQLite's `rowid` as the second sort key.
- **Why:** timestamps aren't unique, so sorting on them alone gives a random winner on a tie (see the incident below).
- **Alternative not taken:** a sequence column. It would need a schema change for a case only fast machines hit.
- **Follow-up:** Restore must keep this order (GYM-103).

### 2026-11-13: A bodyweight 1RM is the total load (GYM-24, PR #38, plan decision 6)
- **Decision:** for exercises like pull-ups, the stored 1RM, the best set and the e1RM all use body weight plus the added load. The body weight is the one on the session date; for the "BW + x" label it's the latest one.
- **Why:** "BW + 10 kg" means something different for a 60 kg and a 90 kg client. The total load is what the muscles moved.
- **Alternative not taken:** the Python tool ranks such sets by the added load only. This is a known, intended difference from the tool.

### 2026-11-13: Golden-file test against the Python tool (GYM-23, PR #37)
- **Decision:** `tests/golden/make_recovery_golden.py` runs the real `build_recovery` from `legacy/gym_tracker.py` on a made-up sample and saves its output as JSON. A Jest test checks that `domain/recovery.ts` gives the same days and status for every pattern and muscle.
- **Why:** it proves the port matches the old tool, instead of trusting a re-reading of the code. Anonymised fixtures keep personal data out of git.

### 2026-11-13: A finished session is edited with the same screens (GYM-102, PR #36, plan decision 4)
- **Decision:** the session, reorder and exercise pages get an edit mode, instead of separate edit screens.
  - A set change doesn't reopen an exercise in a finished session.
  - Reorder stays available with one exercise left, so "delete last exercise" can happen.
  - "Last time" uses a point-in-time query, so it never shows the edited session or a later one.
- **Why:** one set of screens to build, test and keep consistent.
- **Cost:** the pages branch on `session.status`.

### 2026-11-13: History in one aggregate query (GYM-22, PR #35)
- **Decision:** `listHistory` gets each session with its exercise and set counts in one `LEFT JOIN … GROUP BY` query.
- **Why:** it avoids the N+1 query problem, which would cost one extra query per session. The owner asked whether loading the whole history would be slow (owner, in chat).

### 2026-11-13: Client tabs switch with `router.replace` (GYM-22, PR #35, plan decision 2)
- **Decision:** Profile | History | Recovery | Progress replace each other in the navigation stack, so "‹ Clients" always goes back in one tap. "Start session" moved to the History tab.
- **Why:** pushing a screen per tab would pile up the stack, and back would walk through every tab visited.

### 2026-11-13: Category is hidden, not dropped (GYM-99, PR #34)
- **Decision:** the `exercises.category` column, the seed values and `CATEGORIES` stay; no screen shows or asks for it. Add exercise derives it from the pattern (`categoryForPattern`), because the column is NOT NULL.
- **Why:** the owner may reuse it for equipment categories (GYM-109). Hiding can be undone; dropping data can't.
- **History:** the first version dropped the column with a migration, and the owner reversed that (see the incident below).

### 2026-11-12: Oversized stories split by user value (PR #32)
- **Decision:**
  - GYM-22 lost "edit a finished session", which became GYM-102.
  - GYM-26 lost "restore from backup", which became GYM-103.
- **Why:** one story, one reviewable PR. The split is by what the user can do, not by technical layer.

## Incidents and bugs

### 2026-11-13: Docs edited by script lost their `\r\n` text (GYM-25, PR #42)
- **What:** the edit scripts ran through two layers of escaping: a shell heredoc, then a Python string or a `re.sub` replacement. Both treat a backslash specially, so the text `\r\n` in the spec, this log and a test comment became a real line break.
- **Found by:** the review subagent ("REQUEST_CHANGES: docs only").
- **Fix:** a script that builds backslashes with `chr(92)` and passes a function, not a string, to `re.sub`. A sweep confirmed no other changed file has a stray carriage return.
- **Lesson:** when text contains backslashes, avoid stacked escaping, and read the result back before committing.

### 2026-11-13: A test passed by luck, and git would have rewritten the fixture (GYM-25, PR #42)
- **The test:** the recovery golden test read the sample CSV with a naive `split(',')`. When the sample gained a BOM, `\r\n` and a quoted note with a comma, the test still passed. `trim()` happens to remove the BOM, and the broken columns were ones it never read. It now uses `parseCsv`.
- **The fixture:** the repo's `.gitattributes` (`* text=auto eol=lf`) would have turned the fixture's `\r\n` into `\n` on commit, quietly removing the case the import test exists for. A narrow `-text` rule keeps that one file byte-for-byte.
- **Lesson:** check that a test fails for the right reason, and check what git does to binary-ish test data.

### 2026-11-13: PR title without a Jira key (GYM-122, PR #39)
- **What:** this log's first PR title had no `GYM-<n>` key, and the `title` check (commitlint with the Jira plugin) failed.
- **Fix:** ticket GYM-122 was created and the PR renamed.
- **Lesson:** every change, docs included, starts from a Jira ticket. That's also what the squash-commit rule enforces.

### 2026-11-13: Spec-changing PRs opened without `needs-owner` (PR #37, PR #38)
- **What:** CLAUDE.md requires owner approval for PRs that change the spec. PRs #37 and #38 edited the spec but were opened without the label. The #38 reviewer caught it.
- **Impact:** none in the end. The owner approved both merges (owner, in chat).
- **Lesson:** before opening a PR, check its diff against the owner-approval list, not only the plan's labels.

### 2026-11-13: Two 1RMs with the same timestamp, so the "current" one was random (GYM-24, PR #38)
- **Found by:** CI. The fast GitHub runner saved two 1RMs in the same millisecond, so the test got the wrong current 1RM. The slower local Windows run passed.
- **Fix:** a `rowid` tie-break, plus a test that freezes the clock to force the tie. The test was checked to fail without the fix.
- **Lesson:** never sort on a non-unique timestamp alone. Timing-dependent tests are flaky tests in disguise.

### 2026-11-13: Merge blocked by the permission check (PR #37)
- **What:** Claude Code's auto-mode permission check refused a merge that had no explicit owner approval in chat (recorded in chat only).
- **Fix:** the owner approved in chat.
- **Note:** the owner asked for approvals to come as clickable buttons.

### 2026-11-13: `FlatList` hid rows in a test (GYM-23, PR #37)
- **What:** the Recovery list rendered only the first 10 of 12 muscles, because `FlatList` virtualizes. The "12 never logged" test failed.
- **Fix:** a plain list, since there are never more than 12 rows. Virtualization is for long lists.

### 2026-11-13: The dialog's `alert` role can't be found in tests (GYM-22, PR #35)
- **What:** the React Native `Modal` doesn't expose `accessibilityRole="alert"` to Testing Library queries.
- **Fix:** tests find dialogs by their text and buttons, as the other dialog tests already did.

### 2026-11-13: The owner reversed "drop the Category column" after it was built (GYM-99, PR #34)
- **What:** migration `0001` dropping the column was written, tested and reviewed. Then the owner decided to keep the column and only hide it.
- **Fix:** the branch was reset to `main` and redone as a UI-only change, so the squash commit has no migration. Sub-task GYM-104 was moved to Done with a comment saying it wasn't needed.
- **Lesson:** for removing data, offer the reversible option (hide) first.

### 2026-11-13: CI red on every branch after Expo patch releases (GYM-101, PR #33)
- **What:** `expo-doctor` failed because Expo released `expo` 58.0.25 and `expo-sqlite` 58.0.17 upstream. Nothing in our code changed. This is dependency drift.
- **Fix:** `npx expo install --fix` in its own small PR before the Sprint 2 plan could merge.
- **Lesson:** pinned versions and a doctor check in CI catch drift early. An "Expo SDK upgrade routine" is on the backlog (GYM-43).

### 2026-11-12: Two wrong claims in planning, corrected on Jira (GYM-22, GYM-99)
- **GYM-22:** Claude said the profile needed a new "Workout history" entry, but the board already had a History tab.
- **GYM-99:** Claude said dropping a column needs a table rebuild in SQLite. SQLite 3.35+ supports `DROP COLUMN` for a column with no index.
- **Fix:** both were corrected in Jira comments and the PR description.
- **Lesson:** check the board and the database docs before stating them as facts.

## Watch list

- **GYM-26 (PR #40 review, small risks):**
  - **Picker errors:** `pickFolder` treats any picker error as a cancel, so a real failure is silent.
  - **Export now vs auto-export:** they aren't queued together, so if both run at the same moment they could leave a "(1)" copy.
  - **Timing gap:** a write made in the tiny gap after an export's last check would be missed until the next write. Nothing triggers this today.
  - **Fresh install:** on a fresh install, creating "Me" before restoring would overwrite today's backup, so Task 10 restores first.
- **Task 10 (phone):** file names from expo-file-system 58 come from the URI. `baseName` strips "primary:" and decodes the name, and the phone check confirms the folder name, and that a second export on one day leaves no "(1)" copy.
- **GYM-103 (Restore):** re-insert `one_rep_maxes` in `(created_at, rowid)` order, so the last 1RM saved stays current after a round trip.
- **GYM-119 (backlog):** a session dated after today would show "-1 days ago" on Recovery. Clamp the value, or have `startSession` refuse a future date. The same ticket makes the golden script write LF line endings.
