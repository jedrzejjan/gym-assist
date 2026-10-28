# Gym Assist

Gym Assist is an Android app for a personal trainer to log training sessions and track progress for their clients and for themselves. It is built with React Native, Expo and TypeScript, stores data locally in SQLite, and is developed by an AI coding agent with the work tracked in Jira (project `GYM`).

- Design: [docs/superpowers/specs/2026-10-28-gym-assist-app-design.md](docs/superpowers/specs/2026-10-28-gym-assist-app-design.md)
- Stage 0 plan: [docs/superpowers/plans/2026-10-28-stage-0-foundations.md](docs/superpowers/plans/2026-10-28-stage-0-foundations.md)
- `legacy/gym_tracker.py`: the Python reference implementation that the app's logic is ported from.

## Commit convention

Every change reaches `main` through a pull request, which is squash-merged into one commit. The PR title becomes that commit message.

- **PR title:** `<type>(<scope>): GYM-<n> <ticket name>`, for example `feat(log): GYM-12 Log set screen`.
- **Branch:** `<type>/GYM-<n>-short-name`.
- **Types:** `feat`, `fix`, `ci`, `build`, `test`, `refactor`, `docs`, `chore`, `perf`.
- **Scopes:** `log`, `clients`, `exercises`, `recovery`, `progress`, `db`, `import`, `design`, `infra`.
