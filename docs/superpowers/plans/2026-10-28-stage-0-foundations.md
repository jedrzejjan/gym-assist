# Stage 0: Foundations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the project a professionally run product:
- a GitHub repo;
- a Jira backlog that holds every stage and ticket;
- MCP connections;
- an Expo + TypeScript app skeleton;
- required CI checks;
- a manual build that puts the skeleton app on the user's phone.

**Architecture:** This folder becomes the repo root and the Expo project root. The Python tool moves to `legacy/` and keeps working. Personal data stays out of git. CI (`ci.yml`) is a reusable workflow. The manual Android build (`build-android.yml`) calls it as a gate before `eas build`.

**Tech Stack:**
- Expo SDK 58 (`expo@58`, current as of 2026-10-28), React Native, TypeScript, Expo Router.
- Jest (`jest-expo`) with React Native Testing Library.
- ESLint (`eslint-config-expo`), Prettier, commitlint.
- GitHub Actions, EAS Build.
- Jira Cloud Free, plus the Atlassian, GitHub and Penpot MCP servers.

**Spec:** `docs/superpowers/specs/2026-10-28-gym-assist-app-design.md`

**Scope:** This plan covers Stage 0 only. The spec is split into separate plans:
- Stage 1, the UX design in Penpot, is conversation and design work and has no code plan.
- Stage 2, the MVP, gets its own plans: one for the domain and data layers, which can start while Stage 1 runs, and one for the screens, written after the Penpot designs are approved.

## Global Constraints

- Stage 0 is timeboxed to 1 week.
- **Claude never creates accounts, never handles secrets and never pushes to `main` directly.** Every step marked **[USER]** is done by the user. Claude waits and then verifies the result.
- **Merging:** Claude squash-merges a PR through the GitHub MCP once CI is green and a fresh review subagent approves it.
  - Every PR in this plan changes CI/CD, repo settings or the app's structure, so it also gets the `needs-owner` label. Claude waits for the user's approval before merging.
  - If the review subagent requests changes, the ticket goes back to In Progress until they are fixed and the review passes.
- The only exception to "never push to `main`" is the bootstrap push in Task 3, and the **user** makes it. That happens before branch protection exists.
- Personal data never enters git: `legacy/data/`, `legacy/reports/`, `legacy/config/`, `legacy/plans/`, `legacy/profile/` and `.claude/skills/log-gym-session/`.
- Never commit `.env*`, `*.jks`, `*.keystore`, `credentials.json`, `*.tfstate*` or `google-services*.json`.
- **PR title** (it becomes the squash commit): `<type>(<scope>): GYM-<n> <ticket name>`.
  - Types: `feat`, `fix`, `ci`, `build`, `test`, `refactor`, `docs`, `chore`, `perf`.
  - Scopes: `log`, `clients`, `exercises`, `recovery`, `progress`, `db`, `import`, `design`, `infra`.
- **Branch name:** `<type>/GYM-<n>-short-name`.
- **Merging:** squash merge only. The branch is deleted after merge. `main` is protected.
- **Builds:** EAS builds are manual only. Claude never starts one unless the user asks.
- **Pull requests:** each one has a description with the ticket link, the changes, how they were tested, and "Agent notes".
- **Line endings:** files use LF (`.gitattributes`). The user's machine is Windows and CI runs on Linux.

## Review Focus

1. **The legacy tool still works after the move.** `python legacy/gym_tracker.py report` must still read the data and write the reports. Tested in Task 3, Step 4.
2. **Dependabot PRs must not be blocked forever.** Their titles have no `GYM-<n>` key. The PR-title check skips the `dependabot[bot]` author, and Dependabot is set to use the `chore` prefix. Tested in Task 5, Step 5.
3. **Bad PR titles must fail the check:** a missing key, a lowercase `gym-12`, an unknown type, or an unknown scope. Tested in Task 5, Step 3.
4. **No secret or personal file can be committed by accident,** including `.env.local`, a keystore, or the CSVs. Tested in Task 3, Step 3.
5. **A failing CI run must stop the manual build** before it uses EAS quota. Tested in Task 7, Step 6.

---

### Task 1: Accounts and MCP connections

**Files:**
- Create: `.mcp.json`

**Interfaces:**
- Produces: working MCP tools for Jira (Atlassian), GitHub and Penpot in Claude sessions in this folder.

- [ ] **Step 1 [USER]: Create the accounts**
  - GitHub, if needed.
  - An Atlassian Cloud site with Jira Free.
  - An Expo account (expo.dev).
  - A Penpot account (design.penpot.app).
- [ ] **Step 2 [USER]: Create a GitHub fine-grained personal access token** for the GitHub MCP.
  - Repository access: the `gym-assist` repo, once it exists. Until then, "All repositories" with the permissions listed next.
  - Permissions: Contents, Pull requests, Issues and Workflows (read/write); Metadata and Actions (read).
  - Store it as the user environment variable `GITHUB_PAT`, then restart the Claude app.
- [ ] **Step 3: Write `.mcp.json`** with three servers. Check each URL against the provider's current docs at setup. The values below were current at the time of writing.
  - `atlassian`: `"type": "http"`, `"url": "https://mcp.atlassian.com/v1/mcp"` (OAuth in the browser).
  - `github`: `"type": "http"`, `"url": "https://api.githubcopilot.com/mcp/"`, `"headers": {"Authorization": "Bearer ${GITHUB_PAT}"}`.
  - `penpot`: `"type": "http"`, with the URL shown in Penpot under Your account → Integrations → MCP Server.

  The file holds no secret values, only `${...}` references.
- [ ] **Step 4 [USER]: Approve the three project MCP servers** when Claude asks, and finish the Atlassian OAuth sign-in in the browser.
- [ ] **Step 5: Verify.** Claude must be able to:
  - list the Jira sites or projects through the Atlassian MCP;
  - call `get_me` (or the equivalent) on the GitHub MCP and get the user's login back;
  - list Penpot projects.

  Each must return data. Report any server that fails to the user, and do not continue to Task 2 without Atlassian working.

### Task 2: Jira project and backlog

**Files:** none in the repo.

**Interfaces:**
- Consumes: the Atlassian MCP (Task 1).
- Produces: the Jira project `GYM`. The keys of the Stage 0 tickets are recorded in the table at the end of this task. Later tasks use them in branch names and PR titles.

- [ ] **Step 1 [USER]: Create the Jira Scrum project** named "Gym Assist", key `GYM`. Create the label `ai-generated`. Check that the statuses are To Do, In Progress, In Review and Done. "In Review" may need to be added to the board workflow.
- [ ] **Step 2 [USER]: Install the "GitHub for Jira" app** from the Atlassian Marketplace, and connect it to the GitHub account. Do the repo connection after Task 3.
- [ ] **Step 3: Create the 5 epics** through the MCP:
  - "Stage 0: Foundations"
  - "Stage 1: UX design (Penpot)"
  - "Stage 2: MVP on the phone"
  - "Stage 3: Backlog after the MVP"
  - "Stage 4: Play Store"
- [ ] **Step 4: Create the Stage 0 tickets**, one per remaining task in this plan:

  | Plan task | Jira summary |
  |---|---|
  | Task 1 | Connect Jira, GitHub and Penpot MCP servers (create it as Done) |
  | Task 2 | Create Jira project and backlog (move it to Done at the end of this task) |
  | Task 3 | Move legacy tool and create GitHub repo |
  | Task 4 | Expo TypeScript app skeleton |
  | Task 5 | CI workflow with required checks |
  | Task 6 | Protect main branch |
  | Task 7 | Manual Android build workflow |

- [ ] **Step 5: Create the Stage 1 tickets:**
  - "User flows"
  - "Low-fidelity wireframes"
  - "Clickable prototype of log-session flow"
- [ ] **Step 6: Create the Stage 2 stories.** Use the spec's sections 4 to 6 as each description, and add no sub-tasks yet. Sub-tasks are created when work on a ticket starts.
  - Database schema, migrations and pre-migration snapshot
  - Exercise catalogue and seed data
  - Clients list and profile
  - Log session: choose exercise and last time
  - Log session: add, edit and delete sets
  - Log session: finish, cancel and one-draft rule
  - History
  - Recovery screen
  - Progress: best set and e1RM
  - CSV import of existing history
  - JSON export, automatic export and restore
  - Android Auto Backup and backup warning
- [ ] **Step 7: Create the Stage 3 tickets from spec section 3, items 1 to 16, in that order.**
  - Item 1 (Terraform) gets priority Highest.
  - Items 11 to 16 get the label `ai-generated`.
  - Items 12 to 16 get priority Low.
- [ ] **Step 8: Create the Stage 4 tickets:**
  - Google Play developer account
  - Privacy policy and GDPR basics
  - Production AAB with Play App Signing
  - Internal and closed testing
  - Production release
- [ ] **Step 9: Verify.** A JQL search `project = GYM` returns the 5 epics and every ticket above, each under the correct epic. Show the user the count per epic and the Stage 0 key table.

| Plan task | Jira key (fill in) |
|---|---|
| Task 3 | GYM-__ |
| Task 4 | GYM-__ |
| Task 5 | GYM-__ |
| Task 6 | GYM-__ |
| Task 7 | GYM-__ |

### Task 3: Move the legacy tool and create the GitHub repo

**Files:**
- Move: `gym_tracker.py`, `data/`, `reports/`, `plans/` and `profile/` into `legacy/`. If `config/` exists, move it too.
- Create: `.gitignore`, `.gitattributes`, `README.md`
- Modify: `.claude/skills/log-gym-session/SKILL.md`. Change every command to `python legacy/gym_tracker.py ...`, every data path to `legacy/data/...`, and the working folder to this folder.
- Commit: `legacy/gym_tracker.py`, `.gitignore`, `.gitattributes`, `README.md`, `CLAUDE.md`, `docs/`

- [ ] **Step 1: Move the files** with `git mv` where tracked, or a plain move where untracked.
- [ ] **Step 2: Write the ignore files.**
  - `.gitignore`: the personal paths and secret patterns from Global Constraints, plus `node_modules/`, `.expo/`, `dist/`, `android/`, `ios/`, `coverage/`, `*.log`, `.claude/settings.local.json` and `__pycache__/`.
  - `.gitattributes`: `* text=auto eol=lf`.
- [ ] **Step 3: Test the ignore rules.**
  - Create the empty test files `.env.local` and `release.jks`.
  - Run `git check-ignore -v .env.local release.jks legacy/data/sessions.csv legacy/profile/gym-training-profile.md .claude/skills/log-gym-session/SKILL.md`.
  - Expected: all 5 paths are printed with the rule that ignores them.
  - Delete the two test files.
- [ ] **Step 4: Run the legacy tool.**
  - Run `python legacy/gym_tracker.py report`, then `python legacy/gym_tracker.py status`.
  - Expected: no error. `legacy/reports/recovery.md` has today's date in its title. `status` prints the patterns table.
- [ ] **Step 5: Write `README.md`.** One paragraph on what the app is, links to the spec and this plan, and the commit convention from Global Constraints.
- [ ] **Step 6: Commit on local `main`.**
  - Run `git status --short`, and check that no personal file is staged.
  - Commit with the message `chore(infra): GYM-<Task 3 key> Move legacy tool and create GitHub repo`.
- [ ] **Step 7 [USER]: Create the GitHub repo and push.**
  - Create an empty **private** repo named `gym-assist`, with no README.
  - Settings → General:
    - allow squash merging only;
    - default commit message "Pull request title";
    - turn on "Automatically delete head branches".
  - Push:
    ```bash
    git remote add origin https://github.com/<user>/gym-assist.git
    ```
    ```bash
    git push -u origin main
    ```
- [ ] **Step 8 [USER]: In the GitHub for Jira app, give it access to the `gym-assist` repo.**
- [ ] **Step 9: Verify.**
  - Through the GitHub MCP, list the files on `main`. Expected: `legacy/gym_tracker.py` is there and `legacy/data/` is not.
  - The Jira ticket for Task 3 shows the commit in its Development panel.
  - Move the ticket to Done.

### Task 4: Expo TypeScript app skeleton

Branch: `build/GYM-<Task 4 key>-expo-skeleton`. Follow the ticket loop in `CLAUDE.md`, with the plan as a Jira comment.

**Files:**
- Create: the Expo project at the repo root, made with `npx create-expo-app@latest` (default TypeScript template, Expo SDK 58, Expo Router). Generate it in a temp folder, then copy it in, because the root is not empty.
- Create: `app/_layout.tsx`, `app/index.tsx`
- Create: `domain/.gitkeep`, `data/.gitkeep`
- Create: `app/__tests__/index.test.tsx`
- Create: `jest.config.js` (preset `jest-expo`), `.prettierrc`, `eslint.config.js` (from `npx expo lint`)
- Modify: `package.json` scripts. Exact names, used later by CI:
  - `lint`: `expo lint`
  - `format:check`: `prettier --check .`
  - `typecheck`: `tsc --noEmit`
  - `test`: `jest`
  - `test:ci`: `jest --ci --coverage`
  - `doctor`: `npx expo-doctor`
- Modify: `app.json`: `name` "Gym Assist", `slug` "gym-assist", `scheme` "gymassist", `android.package` `com.jjtrainer.gymassist` (confirmed by the user).

**Interfaces:**
- Produces:
  - the npm script names above;
  - the folders `app/`, `data/` and `domain/` from spec section 5;
  - the `android.package` ID.

- [ ] **Step 1: Use the Android package ID `com.jjtrainer.gymassist`.** The user confirmed it. It is permanent once the app is on the Play Store.
- [ ] **Step 2: Generate the project and remove the template's demo screens, components and assets.** Keep `assets/` icons only.
- [ ] **Step 3: Write the failing test** `app/__tests__/index.test.tsx`:
  ```tsx
  import { render, screen } from '@testing-library/react-native';
  import Home from '../index';

  test('home screen shows the app name', () => {
    render(<Home />);
    expect(screen.getByText('Gym Assist')).toBeTruthy();
  });
  ```
- [ ] **Step 4: Run** `npm test`. Expected: FAIL, because `../index` does not render "Gym Assist" yet.
- [ ] **Step 5: Implement `app/index.tsx`.** The default export `Home` renders a single centred `<Text>Gym Assist</Text>`. `app/_layout.tsx` renders a `<Stack />`.
- [ ] **Step 6: Run** `npm test`, `npm run lint`, `npm run format:check`, `npm run typecheck` and `npm run doctor`. Expected: all pass.
- [ ] **Step 7 [USER]: Try it on the phone.**
  - Run `npx expo start`, and scan the QR code with Expo Go.
  - Expected: "Gym Assist" appears on the phone.
- [ ] **Step 8: Commit, push the branch, and open the PR** through the GitHub MCP.
  - Title: `build(infra): GYM-<Task 4 key> Expo TypeScript app skeleton`.
  - Move the ticket to In Review and run the review subagent. Add `needs-owner`, get the user's approval, then squash-merge.

### Task 5: CI workflow

Branch: `ci/GYM-<Task 5 key>-ci-workflow`.

**Files:**
- Create: `.github/workflows/ci.yml`
- Create: `commitlint.config.js`
- Create: `scripts/commitlint-jira-plugin.js`
- Create: `.github/dependabot.yml`
- Create: the GitHub label `needs-owner`, through the GitHub MCP
- Test: `scripts/__tests__/commitlint.test.js`

**Interfaces:**
- Consumes: the npm scripts from Task 4.
- Produces:
  - Triggers: `ci.yml` runs on `pull_request` to `main`, on `push` to `main`, and on `workflow_call` (no inputs).
  - Job IDs and status-check names, used in Task 6: `title` (pull requests only) and `checks`.

- [ ] **Step 1: Write the failing test** `scripts/__tests__/commitlint.test.js`. It uses `@commitlint/lint` with the loaded config, and makes 6 assertions:
  - `feat(log): GYM-12 Log set screen` is valid;
  - `chore(infra): GYM-3 Move legacy tool` is valid;
  - `feat(log): Log set screen` is invalid (no key);
  - `feat(log): gym-12 Log set screen` is invalid (lowercase key);
  - `feature(log): GYM-12 Log set screen` is invalid (unknown type);
  - `feat(ui): GYM-12 Log set screen` is invalid (unknown scope).
- [ ] **Step 2: Run** `npx jest scripts`. Expected: FAIL, because there is no config yet.
- [ ] **Step 3: Write the commitlint config and the plugin.**
  - `commitlint.config.js` extends `@commitlint/config-conventional`.
  - `type-enum` and `scope-enum` hold exactly the lists from Global Constraints. `scope-empty` is set to `[2, 'never']`.
  - The plugin adds the rule `subject-jira-key`, which requires the subject to match `/^GYM-\d+ \S/`.
  - Run `npx jest scripts`. Expected: 6 pass.
- [ ] **Step 4: Write `ci.yml`.** Ubuntu, Node 20, with `actions/setup-node` caching npm.
  - **Job `title`:** runs only if `github.event_name == 'pull_request' && github.actor != 'dependabot[bot]'`. Runs `echo "$PR_TITLE" | npx commitlint`, with `PR_TITLE: ${{ github.event.pull_request.title }}` passed through `env`, never inline in the script.
  - **Job `checks`:** `npm ci`, then `lint`, `format:check`, `typecheck`, `test:ci` and `doctor`, in that order.
  - Permissions: `contents: read`.
- [ ] **Step 5: Write `.github/dependabot.yml`.** Two ecosystems, `npm` and `github-actions`, both weekly, with `commit-message.prefix: "chore"`. Check that the `title` job's `if` skips Dependabot PRs, so their titles can't block them.
- [ ] **Step 6: Open the PR** with the title `ci(infra): GYM-<Task 5 key> CI workflow with required checks`.
  - Expected: the `title` and `checks` jobs both run and pass on the PR.
  - Then temporarily change the PR title to `ci: CI workflow` and re-run `title`. Expected: it fails.
  - Restore the title. Expected: it passes again.
- [ ] **Step 7:** Move the ticket to In Review and run the review subagent. Add `needs-owner`, get the user's approval, then squash-merge.

### Task 6: Protect `main`

**Files:** none. This is configured in GitHub. Terraform codifies it later (Stage 3, item 1).

**Interfaces:**
- Consumes: the status-check names `title` and `checks` from Task 5. GitHub shows them only after they have run at least once.

- [ ] **Step 1 [USER]: Add a branch ruleset for `main`** in Settings → Rules → Rulesets.
  - Require a pull request before merging.
  - Require the status checks `title` and `checks` to pass.
  - Block force pushes and deletion.
  - Do not require approving reviews, because the review subagent posts a comment, not a GitHub approval.
  - Do not add a bypass list.
- [ ] **Step 2: Verify.** Claude:
  - makes a throwaway commit on a local branch;
  - tries `git push origin HEAD:main`;
  - expects GitHub to reject it with a ruleset message;
  - deletes the local branch.

  This push is meant to fail. It is the test of the protection.
- [ ] **Step 3:** Comment the result on the ticket and move it to Done.

### Task 7: Manual Android build workflow

Branch: `ci/GYM-<Task 7 key>-android-build`.

**Files:**
- Create: `eas.json`
- Create: `.github/workflows/build-android.yml`
- Modify: `app.json`. `npx eas-cli init` adds `extra.eas.projectId`.

**Interfaces:**
- Consumes: `ci.yml` through `workflow_call` (Task 5), and the `android.package` ID (Task 4).
- Produces: the build profiles `preview` (APK) and `production` (AAB), and the workflow input `profile`.

- [ ] **Step 1 [USER]: Link the project to Expo.** Run `npx eas-cli login`, then `npx eas-cli init`. Then run `npx eas-cli credentials` → Android → `preview`, and let EAS generate and store the keystore.
- [ ] **Step 2 [USER]: Create an Expo access token** (expo.dev → Account settings → Access tokens). Save it as the GitHub Actions secret `EXPO_TOKEN`.
- [ ] **Step 3: Write `eas.json`:**
  ```json
  {
    "cli": { "appVersionSource": "remote" },
    "build": {
      "preview": { "distribution": "internal", "android": { "buildType": "apk" } },
      "production": { "autoIncrement": true, "android": { "buildType": "app-bundle" } }
    }
  }
  ```
- [ ] **Step 4: Write `build-android.yml`.**
  - Trigger: `workflow_dispatch` only, with the input `profile` of type `choice`, options `preview` and `production`, default `preview`.
  - **Job `ci`:** `uses: ./.github/workflows/ci.yml`.
  - **Job `build`:** `needs: ci`.
    - Runs `actions/checkout`, `actions/setup-node`, then `npm ci`.
    - Then `expo/expo-github-action` (pinned to its current major version) with `eas-version: latest` and `token: ${{ secrets.EXPO_TOKEN }}`.
    - Then `eas build --platform android --profile ${{ inputs.profile }} --non-interactive --no-wait`.
  - Permissions: `contents: read`.
- [ ] **Step 5: Open the PR** with the title `ci(infra): GYM-<Task 7 key> Manual Android build workflow`. Run the review subagent, add `needs-owner`, get the user's approval, then squash-merge. A workflow that uses `workflow_dispatch` can only be run once it is on `main`.
- [ ] **Step 6: Test the gate** (Review Focus 5).
  - **[USER]** runs "Build Android" from a branch with a deliberately failing test.
  - Expected: job `ci` fails, job `build` is skipped, and no build appears on expo.dev.
  - Delete the branch afterwards.
- [ ] **Step 7 [USER]: Run "Build Android" on `main` with the `preview` profile.**
  - Expected: both jobs are green within a few minutes, and the build appears on expo.dev.
  - When it finishes (about 10–20 minutes), install the APK from the QR code and check that "Gym Assist" opens on the phone.
- [ ] **Step 8: Close out.**
  - Move the ticket to Done.
  - Comment the Stage 0 result on the epic: what was built, what was deferred, and any new tickets.
  - The Stage 0 epic is done.
