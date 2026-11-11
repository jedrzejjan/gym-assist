# Stage 1: UX Design in Penpot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Approved designs for every MVP screen in Penpot, plus a clickable prototype of the log-session flow that the owner has tested in the gym, so Stage 2 can build screens without guessing.

**Architecture:**
- The Penpot file **Gym Assist UX** holds the design. It has four pages: `Kit`, `Flows`, `Log session`, `Other screens`.
- Kit components on `Kit` are reused on every board.
- Two check functions kept in the repo (`docs/design/penpot-checks.js`) are pasted into the Penpot MCP's `execute_code`. They are the automated "tests" for the boards and the prototype links.
- The owner approves every flow and screen from screenshots exported into chat.
- **Work order B** (owner's choice): the log-session flow goes end to end first (flow, wireframes, prototype), then the other screens.

**Tech Stack:** Penpot (design.penpot.app) through the Penpot MCP (`execute_code`, `export_shape`), Jira through the Atlassian MCP, GitHub through the GitHub MCP.

**Spec:** `docs/superpowers/specs/2026-10-28-gym-assist-app-design.md`, mainly section 4 (log-session flow) and section 5 (screens, backup plan, errors). It was updated on 2026-11-10 by GYM-59.

**Jira:**

| Task | Ticket |
|---|---|
| 1 | GYM-13 sub-task "Penpot kit and check script" |
| 2 | GYM-13 sub-task "Log-session flow" |
| 3 | GYM-14 sub-task "Log-session wireframes" |
| 4 | GYM-15 |
| 5 | GYM-13 sub-task "Other flows" |
| 6 | GYM-14 sub-task "Other wireframes" |
| 7 | New task under GYM-2, "Design index for Stage 2" |

## Global Constraints

- **Boards:** 360 × 800 (a standard Android phone). One board per screen state.
- **Dialog boards:** 360 × 800, made of a dim layer (muted `#94A3B8` at 50%, the owner's choice in Task 4) plus a `kit/dialog`, with no copy of the screen underneath. The prototype opens them as overlays over the current screen.
- **Palette (changed by the owner in Task 3):** the plan started grey only. The owner replaced it with a navy palette like trainwell.pl, then changed the electric blue accent to a lighter navy: navy `#0F172A`, accent `#233662` (primary action), white, background `#F2F2F2`, secondary text `#364151`, muted `#94A3B8`, lines `#E2E8F0`, Poppins, pill buttons. The full list is in `docs/design/README.md`. No images, and no icons beyond simple shapes or text labels.
- **One-handed use:** tap targets are at least 48 × 48. Text is at least 14 px (body 16, titles 20). The primary action of each screen sits in the bottom third.
- **Copy:** UI in English. Exercise names show the English name with the Polish one under it. Use the spec's exact strings:
  - "Last time: 60 kg × 8, 60 kg × 8, 62.5 kg × 6" and "First time";
  - "Finish exercise", "Finish session", "Cancel session", "Discard this session?";
  - "Remove this exercise and its sets?";
  - "Resume", "Finish it", "Discard it";
  - "Delete this session?" (removing the last exercise of a finished session);
  - "Delete this session? This cannot be undone." (the "Delete session" button);
  - "Replace the weight for this date?";
  - "This replaces all data in the app".
- **Units:** kg and cm only. A blank value shows as "-".
- **Out of scope:** don't draw box height, cardio, set notes, the left/right side, planning, measurements other than weight, charts, or the questionnaire. (The Add exercise page started out of scope; GYM-70 moved it into the MVP, and it is drawn as `library/add exercise`.)
- **No new product decisions in boards.** If a screen needs behaviour the spec doesn't describe, draw it as a **proposal**: the board name ends in `(proposal)`, and the summary posted to the owner asks a yes or no question. Owner-approved proposals are written into the spec before the task closes, each through its own ticket (a new task under GYM-2) and its own `needs-owner` PR, so every ticket keeps one PR. Rejected ones are deleted. Details the spec doesn't name, such as a count shown after an import or a "restore done" screen, are proposals too: list them in the owner summary.
- **Naming:**
  - boards: `<area>/<screen>[ - <state>]`, for example `log/exercise - first time` or `log/dialog - discard session`;
  - components: `kit/<name>`;
  - flow nodes: `flow/<area>/<step>`.
- **Approval:** the owner approves each flow and each group of screens from exported PNGs posted in chat. Nothing counts as approved without an explicit "approved" from the owner. Changes after approval go back to the owner.
- **Jira:**
  - Each ticket gets its plan comment and sub-tasks before any work on it.
  - Move tickets To Do → In Progress → **In Review** (while the owner is reviewing posted PNGs) → Done.
  - Penpot work has no pull request, so the owner's approval is the review gate.
- **Repo changes** (`docs/design/`, the spec) follow `CLAUDE.md`:
  - a branch `docs/GYM-<n>-short-name`;
  - a PR whose description has the ticket link, the changes, how they were tested, and "Agent notes";
  - merge only once CI is green and the review subagent has approved, and also the owner if the PR changes the spec (`needs-owner`).
- **Penpot tab:** the owner keeps the **Gym Assist UX** tab open and connected (**File → MCP Server → Connect**). If `execute_code` reports "No Penpot instance connected", ask the owner to focus the tab and reconnect. Don't retry in a loop.
- **Helpers:** `penpotUtils.getPageByName`, `penpotUtils.findShapes` and `penpotUtils.isContainedIn` exist, according to the Penpot MCP's `high_level_overview`, and `Text.textBounds` exists in the Penpot API (`penpot_api_info`, type `Text`). Read it again at the start of each session.

## Review Focus

1. **Reach and thumb use:** an owner holding a barbell bar in one hand must reach Add set, the weight and reps inputs and Finish exercise with the other thumb. Check in the prototype test (Task 4).
2. **Number entry:** weight takes a comma or a dot ("22,5") and can be blank; reps are whole numbers and can be blank. The set row shows "-" for a blank value. Draw a `log/exercise - blank values` state.
3. **Long exercise names:** the longest English and Polish names from `legacy/data/exercises.csv` must fit in list rows and the exercise header without overflowing their row (wrap to 2 lines, then ellipsis). `checkBoards` flags text that leaves its parent.
4. **Coming back to a draft:**
   - The spec says the trainer "continues the draft where they left off", and that starting a session while a draft exists shows the draft prompt.
   - Task 2 draws the prompt on "Start session".
   - Task 2 also offers two **proposals** for how the trainer gets back to a draft after the app closes: a "Session in progress" bar on Clients, and opening straight into the draft. The owner chooses.
5. **Empty and first-use states:** a client with no history, "First time", an empty search result, no weight entered, a recovery screen where everything is "never logged", and a Clients list holding only "Me". Each gets a board.

---

### Task 1: Penpot file, kit and check script

**Files:**
- Create: `docs/design/penpot-checks.js`
- Penpot: pages `Kit`, `Flows`, `Log session`, `Other screens` in **Gym Assist UX**

**Interfaces:**
- Produces, in `docs/design/penpot-checks.js` (stored in `storage` when pasted):
  - **`checkBoards(pageName: string, expected: string[], opts?: { ignoreSize?: boolean }): { missing: string[], extra: string[], wrongSize: string[], smallText: string[], smallTargets: string[], overflow: string[] }`**
    - "Boards" are the page's top-level shapes of type `board`. On `Kit` these are the main components.
    - `missing`: expected names with no board.
    - `extra`: boards not in `expected`. On `Flows`, ignore names starting with `flow/`.
    - `wrongSize`: boards that aren't 360 × 800. Skipped when `ignoreSize` is set.
    - `smallText`: board and text names where the text has `fontSize` < 14.
    - `smallTargets`: component instances of `kit/button primary`, `kit/button secondary`, `kit/list row`, `kit/set row`, `kit/number field` or `kit/search field` (matched by `shape.component()?.name`, not by shape name) that are smaller than 48 in either dimension.
    - `overflow`: descendants not contained in their board, plus text whose `textBounds` lie outside its parent's bounds.
  - **`checkLinks(pageName: string, startBoards: string[]): { unreachable: string[], deadEnds: string[], dialogsMissingActions: string[] }`**
    - `unreachable`: boards, other than `startBoards`, that no interaction on the page navigates to or opens as an overlay.
    - `deadEnds`: non-dialog boards with no outgoing interaction.
    - `dialogsMissingActions`: boards whose name contains `/dialog` and that have fewer than 2 outgoing interactions (one per button).
  - Kit components:
    - `kit/app bar` (title, and a text "Back" control);
    - `kit/button primary` and `kit/button secondary` (full width, height 56);
    - `kit/list row` (title, subtitle, 2 lines, height ≥ 64);
    - `kit/set row` ("1   60 kg × 8", with tap-to-edit);
    - `kit/number field` (label, value, height 56);
    - `kit/dialog` (title, body, two buttons);
    - `kit/banner` (one line of text and an action);
    - `kit/tab bar` (Profile, History, Recovery, Progress);
    - `kit/search field`.

- [ ] **Step 1: Comment the Stage 1 plan on GYM-13 and create its sub-tasks:** "Penpot kit and check script", "Log-session flow", "Other flows". Move GYM-13 and the first sub-task to In Progress.
- [ ] **Step 2: Write `checkBoards` and `checkLinks` in `docs/design/penpot-checks.js`.** Each one returns its object and logs nothing.
- [ ] **Step 3: Run them on the empty file to see them fail.**
  - Run through `execute_code`: paste the file, then `return storage.checkBoards('Kit', ['kit/app bar'], { ignoreSize: true })`.
  - Expected: an error that the page `Kit` isn't found.
  - Then `return storage.checkLinks('Kit', [])`. Expected: an error that the page isn't found.
- [ ] **Step 4: Create the four pages, and build the 10 kit components on `Kit`** with the Global Constraints colours and sizes. Use flex layouts.
- [ ] **Step 5: Run `checkBoards('Kit', <the 10 kit names>, { ignoreSize: true })`.**
  - Expected: `missing`, `extra`, `smallText`, `smallTargets` and `overflow` all empty.
- [ ] **Step 6: Open the PR `docs(design): GYM-13 Penpot board check script`** from branch `docs/GYM-13-penpot-check-script`.
  - Run the review subagent and merge per Global Constraints.
  - Move the sub-task to Done.
  - The kit PNG is shown to the owner with Task 3's first group.

### Task 2: Log-session flow (GYM-13)

**Files:**
- Penpot: page `Flows`, a group of `flow/log/*` nodes and arrows
- Modify, only if the owner approves a proposal: `docs/superpowers/specs/2026-10-28-gym-assist-app-design.md` (section 4)

**Interfaces:**
- Consumes: the `Flows` page from Task 1.
- Produces: the approved flow, and the owner's answer on the draft-return proposals. Task 3 draws `clients/list - session in progress` only if proposal A is approved.

- [ ] **Step 1: Move the sub-task "Log-session flow" to In Progress.**
- [ ] **Step 2: Draw the flow from spec section 4,** one node per step and decision. Every node and arrow label below must be on the board:
  - entry: Clients → Client → "Start session".
  - **decision "Draft exists?"**: yes → the draft prompt (Resume / Finish it / Discard it; for an empty draft, Resume / Discard it). Discard it → "Discard this session?".
  - Start session: the date is today, or a changed date.
  - Session (choose-exercise page): by pattern → pattern list → exercise, or full list + search → exercise. "New exercise" is shown as a greyed **backlog** node with no arrow.
  - Exercise: shows "Last time: …" or "First time"; Add set (weight, reps, either blank); tap a set → edit; delete set (the remaining sets keep their numbers); "Finish exercise" → back to the Session.
  - Session: reorder exercises, remove an exercise ("Remove this exercise and its sets?"), open a finished exercise again.
  - "Finish session" (needs at least one exercise) → the automatic backup export → Client.
  - "Cancel session" → "Discard this session?" → Client.
  - A note node: "Saved as a draft after every set."
- [ ] **Step 3: Draw the two draft-return proposals** as flow nodes marked `(proposal)`:
  - **A:** the Clients screen shows a "Session in progress" bar while a draft exists, and tapping it resumes the draft.
  - **B:** opening the app while a draft exists goes straight to the draft.
- [ ] **Step 4: Run `checkBoards('Flows', [])`.** Expected: empty `smallText` and `overflow`.
- [ ] **Step 5: Export the flow group and post it to the owner.**
  - Include a 5-line summary, plus the question: "A, B, both, or neither?"
  - Move the sub-task to In Review.
- [ ] **Step 6: Apply the owner's changes until the owner says "approved".**
  - If a proposal is approved, create the task "Record how the trainer returns to a draft" under GYM-2 (key GYM-p), and open the `needs-owner` PR `docs(design): GYM-p Record how the trainer returns to a draft` from `docs/GYM-p-draft-return` that adds it to spec section 4. Merge it per Global Constraints, and move GYM-p to Done.
  - Delete the rejected proposal nodes.
  - Comment the approval and the PNG on the sub-task, then move it to Done.

### Task 3: Log-session wireframes (GYM-14)

**Files:**
- Penpot: page `Log session`

**Interfaces:**
- Consumes: the kit from Task 1, and the approved flow and proposal answer from Task 2.
- Produces: the boards below, named exactly as listed. Task 4 links them, and Stage 2 tickets GYM-19, GYM-20 and GYM-21 link to them.

Boards (20, plus 1 more if proposal A was approved):
```
clients/list
client/overview
client/overview - draft exists
log/dialog - draft exists
log/dialog - draft exists (empty)
log/start - date
log/session - empty
log/session - with exercises
log/session - reorder
log/dialog - remove exercise
log/dialog - discard session
log/choose - patterns
log/choose - pattern exercises
log/choose - search
log/choose - search no results
log/exercise - first time
log/exercise - last time
log/exercise - editing set
log/exercise - after delete
log/exercise - blank values
clients/list - session in progress      (only if proposal A was approved)
```
- `client/overview - draft exists` looks like `client/overview`, but its "Start session" opens the draft prompt. A Penpot button holds one interaction, so the draft case needs its own board. If proposal A is approved, tapping a client row on `clients/list - session in progress` leads to it.
- `log/exercise - after delete` shows set numbers 1, 3 and 4 after set 2 was deleted.
- `log/session - with exercises` shows one exercise marked finished, which can be opened again.

- [ ] **Step 1: Comment the plan on GYM-14 and create sub-tasks** "Log-session wireframes" and "Other wireframes". Move GYM-14 and the first sub-task to In Progress.
- [ ] **Step 2: Run `checkBoards('Log session', <the board names>)` to see it fail.**
  - Expected: every name in `missing`.
- [ ] **Step 3: Draw the boards from kit instances,** following the approved flow, the Global Constraints and Review Focus items 2–5.
  - Use real exercise names from `legacy/data/exercises.csv`, including the longest English and Polish names.
  - Use sample client names only, never real client data.
- [ ] **Step 4: Run the check again.**
  - Expected: `missing`, `extra`, `wrongSize`, `smallText`, `smallTargets` and `overflow` are all empty.
- [ ] **Step 5: Export and post to the owner in groups,** then move the sub-task to In Review:
  1. the kit, entry and the draft prompts;
  2. start and the session page;
  3. choosing an exercise;
  4. the exercise screen.
- [ ] **Step 6: Apply the owner's changes, re-running the check after each round, until each group is "approved".** Comment the approvals on the sub-task and move it to Done.

### Task 4: Clickable log-session prototype (GYM-15)

**Files:**
- Penpot: interactions on the page `Log session`
  - flow `Log a session`, starting at `clients/list`;
  - flow `Resume a draft`, starting at `clients/list - session in progress` if proposal A was approved, otherwise at `client/overview - draft exists`

**Interfaces:**
- Consumes: the approved boards from Task 3, and `checkLinks` from Task 1.
- Produces: a Penpot view-mode link to both flows, and Penpot links on GYM-19, GYM-20 and GYM-21.

- [ ] **Step 1: Comment the plan on GYM-15 and move it to In Progress.**
- [ ] **Step 2: Add the click interactions:**
  - each arrow in the approved flow becomes a "navigate to" on the tapped element;
  - each dialog board opens as an overlay, and each of its buttons closes it or navigates;
  - "Back" goes to the previous screen.
- [ ] **Step 3: Run `checkLinks('Log session', <the two start boards>)`.**
  - Expected: `unreachable`, `deadEnds` and `dialogsMissingActions` are all empty.
- [ ] **Step 4: Owner test** **[USER]**. Move GYM-15 to In Review.
  - The owner opens `Log a session` in view mode on the phone's browser.
  - They log a pretend session one-handed, standing up: start, choose 2 exercises, add 3 sets, edit one, delete one, reorder, finish.
  - Then they open `Resume a draft` and try the draft prompt and cancel.
  - The owner reports what felt slow, small or out of reach.
- [ ] **Step 5: Fix the findings.**
  - Task 3's `checkBoards` and this task's `checkLinks` must stay clean.
  - Re-export the changed boards, and repeat Step 4 until the owner says "approved".
- [ ] **Step 6: Add the Penpot link and board names to GYM-19, GYM-20 and GYM-21.** Comment the result on GYM-15 and move it to Done.

### Task 5: Other flows (GYM-13)

**Files:**
- Penpot: page `Flows`, groups `flow/clients/*`, `flow/history/*`, `flow/recovery/*`, `flow/settings/*`, `flow/app/*`

**Interfaces:**
- Consumes: the `Flows` page.
- Produces: the approved flows that Task 6's boards follow.

- [ ] **Step 1: Move the sub-task "Other flows" to In Progress, and draw the flows from spec sections 4–6.**
  - **Clients:**
    - add a client (only the first name is required) → Client;
    - edit the profile;
    - archive (not offered for "Me");
    - the backup warning banner → Settings.
  - **Weight:**
    - add a weight (date, today by default);
    - the same date already has one, or an entry is moved to a date that has one → "Replace the weight for this date?";
    - edit an entry; delete an entry.
  - **History:**
    - the list of finished sessions → a finished session → edit, using the log-session screens (date, exercises, order, sets); changes save at once, and the session stays finished;
    - removing the last exercise → "Delete this session?";
    - "Delete session" → "Delete this session? This cannot be undone.".
  - **Recovery and progress:** read-only views on the Client tabs.
  - **Settings:**
    - CSV import → success (a count of sessions imported), or an error listing the failing row and the unknown exercise names (nothing imported);
    - JSON export;
    - choose the backup folder (Android folder picker);
    - "Restore from backup" → "This replaces all data in the app" → done.
  - **App start:** if a migration fails, the app restores the snapshot and shows an error screen instead of opening.
- [ ] **Step 2: Run `checkBoards('Flows', [])`.** Expected: empty `smallText` and `overflow`.
- [ ] **Step 3: Export each group, post it with a short summary, and move the sub-task to In Review.** Iterate until the owner says "approved". Move the sub-task and GYM-13 to Done.

### Task 6: Other wireframes (GYM-14)

**Files:**
- Penpot: page `Other screens`

**Interfaces:**
- Consumes: the kit and the Task 5 flows. Reuses the layout of `clients/list` and `client/overview` from Task 3.
- Produces: the boards below. Stage 2 tickets GYM-16, GYM-18, GYM-22, GYM-23, GYM-24, GYM-25, GYM-26 and GYM-27 link to them.

Boards (28):
```
clients/list - only me
clients/list - backup warning
clients/add
client/profile
client/profile - me
client/profile - empty
client/dialog - archive
weight/history
weight/add
weight/edit
weight/dialog - replace
weight/dialog - delete (proposal)
history/list
history/list - empty
history/session
history/session - editing
history/dialog - delete last exercise
history/dialog - delete session
recovery/list
recovery/list - never logged
progress/list
progress/list - empty
settings/main
settings/import - done
settings/import - error
settings/dialog - restore
settings/restore - done
app/error - migration failed
```
- `client/profile - me` has no Archive action.
- `history/session - editing` shows the date control and the "Delete session" button.
- `settings/import - error` shows the failing row and the unknown names.
- `settings/import - done` (a count of sessions imported) and `settings/restore - done` are details the spec doesn't name. List them in the owner summary as proposals.
- `weight/dialog - delete (proposal)` asks for confirmation. Its wording is a proposal: "Delete this weight entry?" (the spec gives no string).

- [ ] **Step 1: Move the sub-task "Other wireframes" to In Progress, and run `checkBoards('Other screens', <the 28 names>)` to see it fail.**
  - Expected: all 28 names in `missing`.
- [ ] **Step 2: Draw the 28 boards.**
  - Recovery shows a status per pattern and per muscle, with the spec's four labels:
    - "recovering, too soon";
    - "in supercompensation window (48–72 h)";
    - "due";
    - "never logged".
  - Progress shows the best set and e1RM per exercise, with numbers only (no charts).
  - Client age is shown from the date of birth, for example "34 years".
- [ ] **Step 3: Run the check again.** Expected: all lists empty.
- [ ] **Step 4: Export and post the boards in groups, then move the sub-task to In Review:**
  1. clients and profile;
  2. weight;
  3. history;
  4. recovery and progress;
  5. settings and the app error.
  - Iterate until each group is "approved".
  - Proposals the owner approves in this task (the delete-weight wording, the import count, the restore-done screen) go into the spec together: create the task "Record the Stage 1 screen details" under GYM-2 (key GYM-q), and open the `needs-owner` PR `docs(design): GYM-q Record the Stage 1 screen details` from `docs/GYM-q-screen-details`. Remove `(proposal)` from approved board names, and use the new names in the expected list for `checkBoards('Other screens', …)` here and in Task 7.
- [ ] **Step 5: Add the Penpot links and board names to GYM-16, GYM-18 and GYM-22 to GYM-27.** Move the sub-task and GYM-14 to Done.

### Task 7: Design index and Stage 1 close-out

**Files:**
- Create: `docs/design/README.md`

**Interfaces:**
- Consumes: every approved board name from Tasks 3 and 6, and the prototype links from Task 4.

- [ ] **Step 1: Create the task "Design index for Stage 2" under GYM-2** (key GYM-n), comment its plan, and move it to In Progress.
- [ ] **Step 2: Write `docs/design/README.md`:**
  - the Penpot file name and link;
  - the page list;
  - one table per page: board name → Stage 2 ticket;
  - the prototype links;
  - how to run `penpot-checks.js`.
- [ ] **Step 3: Run `checkBoards` on both screen pages and `checkLinks` on `Log session` one last time.** Expected: all lists empty. Paste the results into the PR description.
- [ ] **Step 4: Open the PR `docs(design): GYM-n Design index for Stage 2`** from branch `docs/GYM-n-design-index`, and merge it per Global Constraints. Move GYM-n to Done.
- [ ] **Step 5: Comment the Stage 1 summary on epic GYM-2,** with what was approved, the prototype test findings, and anything deferred to the backlog. Move GYM-2 to Done.
