# Gym Assist design index

The owner approved these UX designs in Stage 1 (epic GYM-2). Stage 2 builds each screen from its board. If a board and the spec (`docs/superpowers/specs/2026-10-28-gym-assist-app-design.md`) disagree, the spec wins. Changing a screen away from its board needs the owner's approval (see `CLAUDE.md`).

## Penpot file

- **File:** "Gym Assist UX" ([open in Penpot](https://design.penpot.app/?screen=workspace&team-id=bfddaaba-4180-81d4-8008-dbc5d8e4b68c&project-id=17092c62-56e2-8122-8008-ebb8fb72a67c&file-id=17092c62-56e2-8122-8008-ebb90156d9dd), file id `17092c62-56e2-8122-8008-ebb90156d9dd`). The owner's Penpot account holds it, and the link works only when signed in to an account with access.
- **Pages:**
  - `Kit`: the 10 shared components, listed below.
  - `Flows`: the user-flow diagrams (`flow/*` groups).
  - `Log session`: 26 phone boards (360 × 800) and the clickable prototype.
  - `Other screens`: 37 phone boards (360 × 800).

Penpot shows a "/" in a name as "a / b". This index writes names the way the plan does (`log/session - empty`), and `penpot-checks.js` treats both forms as the same.

## Visual style

| Token | Value | Used for |
|---|---|---|
| Navy | `#0F172A` | App bar, titles, main text |
| Accent | `#233662` | Primary buttons, Home tiles, selected chips, links |
| White | `#FFFFFF` | Cards, rows, fields, text on navy |
| Background | `#F2F2F2` | Screen background |
| Slate | `#364151` | Secondary text, field labels |
| Muted | `#94A3B8` | Hints, empty states. Also the dialog dim layer, at 50% |
| Line | `#E2E8F0` | Field borders, row dividers |
| On navy | `#CBD5E1` | Secondary text on navy and on the accent |
| Warning | `#FEF3C7` with navy text | Backup warning banner on Home |

- **Font:** Poppins, 400 for body text and 600 for titles and buttons. Text is at least 14 px.
- **Buttons:** pill-shaped (corner radius 28), 56 px high. Every tap target is at least 48 × 48 px.
- **Thumb reach:** the main actions sit at the bottom of the screen.

## Kit components (`Kit` page)

`kit/app bar`, `kit/button primary`, `kit/button secondary`, `kit/list row`, `kit/set row`, `kit/number field`, `kit/search field`, `kit/tab bar`, `kit/dialog`, `kit/banner`.

## `Log session` page → Stage 2 tickets

| Board | Ticket |
|---|---|
| `home` | GYM-18 |
| `home - session in progress` | GYM-21 |
| `clients/list` | GYM-18, GYM-19 |
| `clients/list - draft exists` | GYM-18, GYM-19, GYM-21 |
| `client/overview` | GYM-18, GYM-19 |
| `client/overview - draft exists` | GYM-18, GYM-19, GYM-21 |
| `log/start - date` | GYM-19 |
| `log/session - empty` | GYM-19 |
| `log/choose - patterns` | GYM-19 |
| `log/choose - pattern exercises` | GYM-19 |
| `log/choose - search` | GYM-19 |
| `log/choose - search no results` | GYM-19 |
| `log/exercise - first time` | GYM-19, GYM-20 |
| `log/exercise - last time` | GYM-19, GYM-20 |
| `log/exercise - editing set` | GYM-20 |
| `log/exercise - after delete` | GYM-20 |
| `log/exercise - blank values` | GYM-20 |
| `log/exercise - percent mode` | GYM-20 |
| `log/exercise - bodyweight` | GYM-20 |
| `log/exercise - percent unavailable` | GYM-20 |
| `log/session - with exercises` | GYM-21 |
| `log/session - reorder` | GYM-21 |
| `log/dialog - remove exercise` | GYM-21 |
| `log/dialog - discard session` | GYM-21 |
| `log/dialog - draft exists` | GYM-21 |
| `log/dialog - draft exists (empty)` | GYM-21 |

## `Other screens` page → Stage 2 tickets

`home` is on both pages. The copy on `Other screens` is the source of truth. The copy on `Log session` exists so the prototype can start from Home.

| Board | Ticket |
|---|---|
| `app/welcome` | GYM-18 |
| `app/create my profile` | GYM-18 |
| `home` | GYM-18 |
| `home - backup warning` | GYM-27 |
| `clients/list - only me` | GYM-18 |
| `clients/list - empty` | GYM-18 |
| `clients/add` | GYM-18 |
| `client/profile` | GYM-18 |
| `client/profile - me` | GYM-18 |
| `client/dialog - archive` | GYM-18 |
| `weight/history` | GYM-18 |
| `weight/add` | GYM-18 |
| `weight/edit` | GYM-18 |
| `weight/dialog - replace` | GYM-18 |
| `weight/dialog - delete` | GYM-18 |
| `history/list` | GYM-22 |
| `history/list - empty` | GYM-22 |
| `history/session` | GYM-22 |
| `history/session - editing` | GYM-22 |
| `history/dialog - delete last exercise` | GYM-22 |
| `history/dialog - delete session` | GYM-22 |
| `recovery/list` | GYM-23 |
| `recovery/list - never logged` | GYM-23 |
| `progress/strength` | GYM-24 |
| `progress/strength - no 1RM` | GYM-24 |
| `progress/dialog - estimate 1RM` | GYM-24 |
| `progress/dialog - set 1RM` | GYM-24 |
| `progress/body` | GYM-24 |
| `settings/main` | GYM-25, GYM-26, GYM-27 |
| `settings/import - done` | GYM-25 |
| `settings/import - error` | GYM-25 |
| `settings/dialog - restore` | GYM-26 |
| `settings/restore - done` | GYM-26 |
| `app/error - migration failed` | GYM-16 |
| `library/list` | GYM-17 |
| `library/detail` | GYM-17 |
| `library/add exercise` | GYM-29 |

Each ticket also has a Jira comment that lists its boards and the details to build.

**Not drawn:** the spec also puts a "New exercise" entry in the log-session choose screens. No `log/choose` board shows it. GYM-29 builds it with the same form as `library/add exercise`.

## Prototype

The clickable prototype is on the `Log session` page. To open it, open the file, go to `Log session`, press **View mode** (the play button), and pick a flow:

| Flow | Starts on | What it shows |
|---|---|---|
| Log a session | `home` | Home → Clients → client → start → choose an exercise → log sets → finish |
| Resume a draft | `home - session in progress` | The "Session in progress" bar on Home opens the draft |
| Empty draft prompt | `log/dialog - draft exists (empty)` | What happens when the trainer starts a session while an empty draft exists |

The prototype links the main paths only. Some rows and buttons are not linked. Shortcuts:
- **% of 1RM:** the kg | % chips on `log/exercise - last time`.
- **No 1RM:** the "Back squat" row in the session.
- **Bodyweight:** Patterns → "Pull vertical".

The `Other screens` boards are static, not linked.

## Checking the boards

`docs/design/penpot-checks.js` holds two checks. They run inside Penpot, through the Penpot MCP's `execute_code` tool:

1. Paste the whole file into `execute_code`. It adds `storage.checkBoards` and `storage.checkLinks`. Penpot's plugin `storage` is cleared when the page reloads, so paste it again after a reload.
2. Run `return storage.checkBoards('<page>', [<board names>])`. It reports:
   - missing and extra boards;
   - boards that are not 360 × 800;
   - text under 14 px (or with mixed sizes);
   - kit tap targets under 48 px;
   - shapes that leave their board, and text that leaves its parent shape.

   Use `{ ignoreSize: true }` on `Kit` and `Flows`.
3. Run `return storage.checkLinks('Log session', ['home', 'home - session in progress', 'log/dialog - draft exists (empty)'])`. It reports boards no link reaches, boards with no way out, and dialogs with fewer than two actions.

An empty list means a check passed. The checks don't look at colour contrast or overlapping text, so check those by eye. Jest tests for the checks are in `docs/design/__tests__/`.
