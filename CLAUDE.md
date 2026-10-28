# Gym Assist app

Gym Assist is an Android app for a personal trainer to log training sessions and track progress for their clients, and for themselves. The trainer is the only user. Each client is a profile, and the trainer is the first one ("Me").

It's built and run like a real product: it goes on the user's phone first, then on the Play Store, and it may be sold one day. It's a general training and progress tracker, not a rehab app.

The full design is in `docs/superpowers/specs/2026-10-28-gym-assist-app-design.md`. Read it before planning or coding. If this file and the spec disagree, the spec wins. Update both when the user changes a decision.

## Roles

- **The user is the product owner.** They set priorities and approve product, design, architecture and business decisions. They run builds and test on their phone. They don't review code.
- **A review subagent reviews the code.** It is a fresh Claude subagent that hasn't seen the implementation work. It posts its review on the pull request, approving it or requesting changes.
- **Owner approval.** Before merging, ask the user to approve any pull request that:
  - changes the spec, this file or a product decision;
  - changes the database schema or the folder layers, or adds a new library;
  - changes a screen or flow away from the approved Penpot design;
  - changes CI/CD, repo settings or infrastructure.

  Add the `needs-owner` label, explain the decision in plain language, and wait for the user's approval.
- **Claude is the developer.** Claude writes and splits tickets, codes every ticket, writes tests, opens pull requests and keeps Jira up to date.
- **Learning goal.** The user wants to learn how an AI coding agent works. Make the work visible: plans in Jira comments, sub-tasks that show how a task was split, and "Agent notes" in every pull request.

## Stack

- React Native, Expo and TypeScript. Android first.
- SQLite on the phone (`expo-sqlite` and Drizzle ORM). The app makes no network calls and needs no server in the MVP.
- No AWS in this project. Choosing a server is a backlog item.
- Three layers:
  - `app/` holds screens.
  - `data/` handles reading and saving.
  - `domain/` holds pure training logic.
  - Each layer calls only the one below. Domain functions don't touch the UI or the database.
- UUID IDs and `updated_at` on every table, so a server can be added later.

## Stages (Jira epics)

0. **Foundations:** repo, Jira, MCP connections, CI, Expo skeleton.
1. **UX design in Penpot:** flows, wireframes, then a clickable prototype. Each MVP ticket links to its Penpot board.
2. **MVP on the phone:** clients, exercise library, log session, history, recovery, progress, CSV import, JSON export.
3. **Backlog after the MVP.** **Terraform for the GitHub repo comes first** (`terraform import`, with state kept out of git).
4. **Play Store:** privacy policy, GDPR, AAB build, testing tracks.

Things the user moved to the backlog stay out of the MVP: the Add exercise page, extra set properties (box height, cardio, notes), the left/right side, and the server.

## Tools

- **Jira Cloud** (project key `GYM`) holds every stage, ticket and sub-task. Use the Atlassian MCP.
- **GitHub** holds the repo and runs GitHub Actions. Use the GitHub MCP.
- **Penpot** holds the UX designs. Use the Penpot MCP.
- **EAS Build** produces the Android binaries. It runs **manually only**, because the free tier has a monthly build quota.
- Use MCP servers for external services wherever one exists.

## Working on a ticket

1. Read the ticket in Jira. Ask the user about anything unclear.
2. Post the plan as a Jira comment and create sub-tasks.
3. Move the ticket to In Progress. Create a branch named `<type>/GYM-<n>-short-name`.
4. Write tests first, then the code.
5. Open a pull request titled `<type>(<scope>): GYM-<n> <ticket name>`. The title becomes the squash commit. The description has three parts:
   - the ticket link;
   - the changes and how they were tested;
   - "Agent notes": the plan, what went wrong, and what the tests caught.
6. When CI is green, move the ticket to In Review and run the review subagent.
   - If it requests changes, move the ticket back to In Progress, fix them, and review again.
   - Once it approves, wait for the user if the pull request needs owner approval.
   - Then squash-merge.
7. Move the ticket to Done. Create backlog tickets for anything deferred.

- **Types:** `feat`, `fix`, `ci`, `build`, `test`, `refactor`, `docs`, `chore`, `perf`.
- **Scopes:** `log`, `clients`, `exercises`, `recovery`, `progress`, `db`, `import`, `design`, `infra`.
- **One squash commit per ticket.**

**Definition of Done:**
- CI is green.
- New logic has tests.
- The review subagent has approved the pull request, and so has the user if it needs owner approval.
- The pull request is merged.
- The Penpot design was followed.
- Jira is up to date.

## Rules for Claude

- Never push to `main` directly, and never bypass branch protection.
- Merge only through a pull request with green CI and an approving subagent review, plus the user's approval when the pull request needs it.
- Never handle secrets. `EXPO_TOKEN` and other tokens live in GitHub secrets, set by the user. Never commit `.env` files, keystores or Terraform state.
- Never create accounts. The user creates the GitHub, Jira, Expo, Penpot and Google Play accounts and authorises each MCP connection.
- Never run an EAS build unless the user asks.
- Don't commit the user's personal training data (the legacy CSV files). Tests use small anonymised samples.
- Keep the MVP scope small. Put new ideas in the Jira backlog, don't build them.

## Coaching

The user is preparing for IT job interviews. When a key concept comes up, explain it with interviews in mind and offer a short quiz (see the global instructions). The user may save a quiz for later. Keep saved quizzes and bring them back at a natural break.

## Legacy files (reference only)

These come from the earlier Gym Assist project, a Python CLI and AI gym assistant. They're here to give context for building the app: the domain logic, the data model and real sample data. They aren't app code, and they'll be removed once the MVP replaces them. In Stage 0 they move to `legacy/`.

- `gym_tracker.py`: the reference implementation. Port its logic to `domain/` and check the app's results against its output, e.g. recovery status and the Epley e1RM.
- `data/exercises.csv`: seed data for the exercise library (PL/EN names, category, training type, pattern, muscles).
- `data/sessions.csv` and `data/visits.csv`: the user's real history, imported into the app as client "Me". Not committed.
- `plans/training-planner.md`: rules for the backlog item "What should I train today?". Recovery windows are 48 to 72 hours.
- `profile/`, `reports/` and `plans/training plan.xlsx`: background only. Don't edit them, and don't delete `plans/training plan.xlsx` unless the user confirms.
- `.claude/skills/log-gym-session`: the old logging workflow. It is not part of the app.
