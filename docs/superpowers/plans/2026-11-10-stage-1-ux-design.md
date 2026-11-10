# Stage 1: UX Design in Penpot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Approved low-fidelity designs for every MVP screen in Penpot, plus a clickable prototype of the log-session flow that the owner has tested in the gym, so Stage 2 can build screens without guessing.

**Architecture:**
- The Penpot file **Gym Assist UX** holds the design. It has four pages: `Kit`, `Flows`, `Log session`, `Other screens`.
- Low-fidelity grey components on `Kit` are reused on every board.
- A check script kept in the repo (`docs/design/penpot-checks.js`) is pasted into the Penpot MCP's `execute_code`. It is the automated "test" for every board.
- The owner approves every flow and screen from screenshots exported into chat.
- **Work order B** (owner's choice): the log-session flow goes end to end first (flow, wireframes, prototype), then the other screens.

**Tech Stack:** Penpot (design.penpot.app) through the Penpot MCP (`execute_code`, `export_shape`), Jira through the Atlassian MCP, GitHub through the GitHub MCP.

**Spec:** `docs/superpowers/specs/2026-10-28-gym-assist-app-design.md`, mainly section 4 (log-session flow) and section 5 (screens, backup plan, errors). It was updated on 2026-11-10 by GYM-59.

**Jira:**

| Task | Ticket |
|---|---|
| 1 | GYM-13 (setup sub-task) |
| 2 | GYM-13, log-session part |
| 3 | GYM-14, log-session part |
| 4 | GYM-15 |
| 5 | GYM-13, other flows |
| 6 | GYM-14, other screens |
| 7 | GYM-2 close-out |

## Global Constraints

- **Boards:** 360 × 800 (a standard Android phone). One board per screen state. Dialogs are their own boards, drawn over a dimmed copy of the screen behind them.
- **Low fidelity:** grey only. The colours are `#FFFFFF`, `#F2F2F2`, `#E0E0E0`, `#9E9E9E`, `#616161` and `#212121`. One accent, `#424242`, marks the primary action. No brand colours, images or icons beyond simple shapes or text labels.
- **One-handed use:** tap targets are at least 48 × 48. Text is at least 14 px (body 16, titles 20). The primary action of each screen sits in the bottom third.
- **Copy:** UI in English. Exercise names show the English name with the Polish one under it. Use the spec's exact strings:
  - "Last time: 60 kg × 8, 60 kg × 8, 62.5 kg × 6" and "First time";
  - "Finish exercise", "Finish session", "Cancel session", "Discard this session?";
  - "Remove this exercise and its sets?";
  - "Resume", "Finish it", "Discard it";
  - "Delete this session?" and "Delete this session? This cannot be undone.";
  - "Replace the weight for this date?";
  - "This replaces all data in the app".
- **Units:** kg and cm only. A blank value shows as "-".
- **Out of scope:** don't draw the Add exercise / New exercise page, box height, cardio, set notes, the left/right side, planning, measurements other than weight, charts, or the questionnaire.
- **Naming:**
  - boards: `<area>/<screen>[ - <state>]`, for example `log/exercise - first time` or `log/dialog - discard session`;
  - components: `kit/<name>`;
  - flow nodes: `flow/<area>/<step>`.
- **Approval:** the owner approves each flow and each group of screens from exported PNGs posted in chat. Nothing counts as approved without an explicit "approved" from the owner. Changes after approval go back to the owner.
- **Jira:**
  - Before starting a ticket, comment its plan on the ticket and create one sub-task per part.
  - Move tickets To Do → In Progress → In Review (waiting for the owner) → Done.
  - Penpot work has no pull request, so the owner's approval is the review gate.
- **Repo changes** (`docs/design/`) go through a PR with green CI and the review subagent, as in `CLAUDE.md`. Use the `docs(design)` type and scope.
- **Penpot tab:** the owner keeps the **Gym Assist UX** tab open and connected (**File → MCP Server → Connect**). If `execute_code` reports "No Penpot instance connected", ask the owner to focus the tab and reconnect. Don't retry in a loop.

## Review Focus

1. **Reach and thumb use:** an owner holding a barbell bar in one hand must reach Add set, the weight and reps inputs and Finish exercise with the other thumb. Check in the prototype test (Task 4).
2. **Number entry:** weight takes a comma or a dot ("22,5") and can be blank; reps are whole numbers and can be blank. The set row shows "-" for a blank value. Draw a `log/exercise - blank values` state.
3. **Long exercise names:** the longest English and Polish names from `legacy/data/exercises.csv` must fit in list rows and the exercise header without overlapping (wrap to 2 lines, then ellipsis). The check script flags text that overflows its board.
4. **Coming back to a draft:** opening the app, or tapping "Start session" while a draft exists, must lead to the draft prompt. The Clients screen shows a "Session in progress" bar that resumes it. Draw both entry points.
5. **Empty and first-use states:** a new client with no history, "First time", an empty search result, no weight entered, and a recovery screen where everything is "never logged". Each gets a board.

---

### Task 1: Penpot file, kit and check script

**Files:**
- Create: `docs/design/penpot-checks.js`
- Penpot: pages `Kit`, `Flows`, `Log session`, `Other screens` in **Gym Assist UX**

**Interfaces:**
- Produces:
  - `checkBoards(pageName: string, expected: string[]): { missing: string[], extra: string[], wrongSize: string[], smallText: string[], smallTargets: string[], overflow: string[] }`. Defined in `docs/design/penpot-checks.js`, stored in `storage.checkBoards` when pasted.
  - Kit components:
    - `kit/app bar` (title with back arrow text);
    - `kit/button primary` and `kit/button secondary` (full width, height 56);
    - `kit/list row` (title, subtitle, 2 lines, height ≥ 64);
    - `kit/set row` ("1   60 kg × 8", with tap-to-edit);
    - `kit/number field` (label, value, height 56);
    - `kit/dialog` (title, body, two buttons);
    - `kit/banner` (warning or "Session in progress");
    - `kit/tab bar` (Profile, History, Recovery, Progress);
    - `kit/search field`.

- [ ] **Step 1: Write `checkBoards` in `docs/design/penpot-checks.js`**
  - It looks up the page by name with `penpotUtils.getPageByName`, then the top-level boards on it.
  - Report:
    - `missing`: expected names with no board;
    - `extra`: boards that aren't expected (ignore names that start with `flow/` on the `Flows` page);
    - `wrongSize`: boards that aren't 360 × 800;
    - `smallText`: text with `fontSize` < 14;
    - `smallTargets`: shapes whose name contains `button`, `row` or `field` and are smaller than 48 in either dimension;
    - `overflow`: descendants not contained in their board (`penpotUtils.isContainedIn`).
  - Return the object. Log nothing.
- [ ] **Step 2: Run it on the empty file to see it fail**
  - Run through `execute_code`: paste the file contents, then `return storage.checkBoards('Kit', ['kit/app bar'])`.
  - Expected: the page isn't found (an error), or `missing: ['kit/app bar']`.
- [ ] **Step 3: Create the four pages, and build the kit components on `Kit`** with the Global Constraints colours and sizes. Use flex layouts.
- [ ] **Step 4: Run the check on `Kit`** with all 10 kit names.
  - Expected: every list is empty except `extra`.
  - `wrongSize` doesn't apply to the kit, so pass the kit names and ignore `wrongSize` for this page only.
- [ ] **Step 5: Export `Kit`** with `export_shape` and post the PNG in chat for the owner. The kit is approved together with the Task 3 screens. No separate approval is needed now.
- [ ] **Step 6: Commit `docs/design/penpot-checks.js`** on branch `docs/GYM-13-penpot-check-script`, open the PR `docs(design): GYM-13 Penpot board check script`, run the review subagent, and merge once CI is green.

### Task 2: Log-session flow (GYM-13, part 1)

**Files:**
- Penpot: page `Flows`, a group of `flow/log/*` nodes and arrows

**Interfaces:**
- Consumes: the `Flows` page from Task 1.
- Produces: the node names that Task 3's screens map onto. Each screen board in Task 3 names its flow node in the board's description.

- [ ] **Step 1: Comment the plan on GYM-13 and create sub-tasks** "Log-session flow" and "Other flows". Move GYM-13 to In Progress.
- [ ] **Step 2: Draw the flow from spec section 4,** one node per step and decision. Every node and every arrow label below must be on the board:
  - entry: Clients → Client → "Start session". Also the Clients "Session in progress" bar → Resume.
  - **decision "Draft exists?"**: yes → the draft prompt (Resume / Finish it / Discard it; for an empty draft, Resume / Discard it). Discard it → "Discard this session?".
  - Start session: the date is today, or a changed date.
  - Session (choose-exercise page): by pattern → pattern list → exercise, or full list + search → exercise. "New exercise" is shown as a greyed **backlog** node with no arrow.
  - Exercise: shows "Last time: …" or "First time"; Add set (weight, reps, either blank); tap a set → edit; delete set; "Finish exercise" → back to the Session.
  - Session: reorder exercises, remove an exercise ("Remove this exercise and its sets?"), open a finished exercise again.
  - "Finish session" (needs at least one exercise) → the automatic backup export → Client.
  - "Cancel session" → "Discard this session?" → Client.
  - A note node: "Saved as a draft after every set; app closed → continue where you left off."
- [ ] **Step 3: Run the check:** `checkBoards('Flows', [])` must return empty `smallText` and `overflow`.
- [ ] **Step 4: Export the flow group and post it for the owner,** with a 5-line text summary of the decisions it shows.
- [ ] **Step 5: Apply the owner's changes until the owner says "approved".** Comment the approval and the PNG on the sub-task, then move it to Done.

### Task 3: Log-session wireframes (GYM-14, part 1)

**Files:**
- Penpot: page `Log session`

**Interfaces:**
- Consumes: the kit from Task 1 and the approved flow from Task 2.
- Produces: the boards below, named exactly as listed. Task 4 links them, and Stage 2 tickets GYM-19, GYM-20 and GYM-21 link to them.

Boards:
```
clients/list - session in progress
client/overview
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
log/exercise - blank values
```

- [ ] **Step 1: Comment the plan on GYM-14 and create sub-tasks** "Log-session wireframes" and "Other wireframes". Move GYM-14 to In Progress.
- [ ] **Step 2: Run `checkBoards('Log session', <the 18 names>)` to see it fail.**
  - Expected: all 18 names in `missing`.
- [ ] **Step 3: Draw the 18 boards from kit instances,** following the approved flow, the Global Constraints and Review Focus items 2–5.
  - Use real exercise names from `legacy/data/exercises.csv`, including the longest English and Polish names.
  - Use sample client names only, never real client data.
- [ ] **Step 4: Run the check again.**
  - Expected: `missing`, `extra`, `wrongSize`, `smallText`, `smallTargets` and `overflow` are all empty.
- [ ] **Step 5: Export the boards and post them to the owner in groups:**
  1. entry and the draft prompts;
  2. start and the session page;
  3. choosing an exercise;
  4. the exercise screen.
  - Post the kit PNG from Task 1 with group 1.
- [ ] **Step 6: Apply the owner's changes, re-running the check after each round, until each group is "approved".** Comment the approvals on the sub-task and move it to Done.

### Task 4: Clickable log-session prototype (GYM-15)

**Files:**
- Penpot: interactions on the page `Log session`, and a flow named `Log a session` that starts at `clients/list - session in progress`

**Interfaces:**
- Consumes: the 18 approved boards from Task 3.
- Produces: a Penpot view-mode link to the `Log a session` flow, and Penpot links on GYM-19, GYM-20 and GYM-21.

- [ ] **Step 1: Comment the plan on GYM-15 and move it to In Progress.**
- [ ] **Step 2: Add the click interactions:**
  - each arrow in the approved flow becomes a "navigate to" on the tapped element;
  - each dialog opens as an overlay;
  - "Back" goes to the previous screen.
- [ ] **Step 3: Check the links with `execute_code`.**
  - Every board on the page except the start board has at least one incoming interaction.
  - Every button and row that the flow uses has an outgoing one.
  - Return the names of any that fail. Expected: none.
- [ ] **Step 4: Owner test** **[USER]**.
  - The owner opens the prototype in view mode on the phone's browser.
  - They log a pretend session one-handed, standing up: start, choose 2 exercises, add 3 sets, edit one, delete one, reorder, finish.
  - They also try cancel and the draft prompt.
  - The owner reports what felt slow, small or out of reach.
- [ ] **Step 5: Fix the findings in the boards** (Task 3's check must stay clean), re-export the changed boards, and repeat Step 4 until the owner says "approved".
- [ ] **Step 6: Add the Penpot link and board names to GYM-19, GYM-20 and GYM-21.** Comment the result on GYM-15 and move it to Done.

### Task 5: Other flows (GYM-13, part 2)

**Files:**
- Penpot: page `Flows`, groups `flow/clients/*`, `flow/history/*`, `flow/recovery/*`, `flow/settings/*`

**Interfaces:**
- Consumes: the `Flows` page.
- Produces: the node names that Task 6's boards map onto.

- [ ] **Step 1: Draw the flows from spec sections 4–6.**
  - **Clients:**
    - add a client (only the first name is required) → Client;
    - edit the profile;
    - archive (not possible for "Me");
    - the backup warning banner → Settings.
  - **Weight:**
    - add a weight (date, today by default);
    - the same date already has one → "Replace the weight for this date?";
    - edit or delete an entry.
  - **History:**
    - the list of finished sessions → a finished session → edit, using the log-session screens; changes save at once, and the session stays finished;
    - removing the last exercise → "Delete this session?";
    - "Delete session" → "Delete this session? This cannot be undone.".
  - **Recovery and progress:** read-only views on the Client tabs.
  - **Settings:**
    - CSV import → success, or an error listing the unknown exercise names (nothing imported);
    - JSON export;
    - choose the backup folder (Android folder picker);
    - "Restore from backup" → "This replaces all data in the app" → done.
- [ ] **Step 2: Run the check:** `checkBoards('Flows', [])` returns empty `smallText` and `overflow`.
- [ ] **Step 3: Export each group, post it with a short summary, and iterate until the owner says "approved".** Move the "Other flows" sub-task and GYM-13 to Done.

### Task 6: Other wireframes (GYM-14, part 2)

**Files:**
- Penpot: page `Other screens`

**Interfaces:**
- Consumes: the kit and the Task 5 flows. Reuses `clients/list - session in progress` and `client/overview` from Task 3 for layout consistency.
- Produces: the boards below. Stage 2 tickets GYM-18, GYM-22, GYM-23, GYM-24, GYM-25, GYM-26 and GYM-27 link to them.

Boards:
```
clients/list
clients/list - backup warning
clients/list - empty
clients/add
client/profile
client/profile - empty
client/dialog - archive
weight/history
weight/add
weight/dialog - replace
history/list
history/list - empty
history/session
history/dialog - delete session
recovery/list
recovery/list - never logged
progress/list
progress/list - empty
settings/main
settings/import - error
settings/dialog - restore
```

- [ ] **Step 1: Run `checkBoards('Other screens', <the 21 names>)` to see it fail.**
  - Expected: all 21 names in `missing`.
- [ ] **Step 2: Draw the 21 boards.**
  - Recovery shows a status per pattern and per muscle, with the spec's four labels:
    - "recovering, too soon";
    - "in supercompensation window (48–72 h)";
    - "due";
    - "never logged".
  - Progress shows the best set and e1RM per exercise, with numbers only (no charts).
  - Client age is shown from the date of birth, for example "34 years".
- [ ] **Step 3: Run the check again.** Expected: all lists empty.
- [ ] **Step 4: Export and post the boards in groups:**
  1. clients and profile;
  2. weight;
  3. history;
  4. recovery and progress;
  5. settings.
  - Iterate until each group is "approved".
- [ ] **Step 5: Add the Penpot links and board names to GYM-18 and GYM-22 to GYM-27.** Move the "Other wireframes" sub-task and GYM-14 to Done.

### Task 7: Design index and Stage 1 close-out

**Files:**
- Create: `docs/design/README.md`

**Interfaces:**
- Consumes: every approved board name from Tasks 3 and 6, and the prototype link from Task 4.

- [ ] **Step 1: Write `docs/design/README.md`:**
  - the Penpot file name and link;
  - the page list;
  - one table per page: board name → Stage 2 ticket;
  - the prototype link;
  - how to run `penpot-checks.js`.
- [ ] **Step 2: Run the check on both screen pages one last time.** Expected: all lists empty. Paste the results into the PR description.
- [ ] **Step 3: Open the PR `docs(design): GYM-2 Design index for Stage 2`,** run the review subagent, and merge once CI is green.
- [ ] **Step 4: Comment the Stage 1 summary on epic GYM-2,** with what was approved, the prototype test findings, and anything deferred to the backlog. Move GYM-2 to Done.
