"""Writes domain/__tests__/fixtures/recovery-golden.json from the legacy Python tool.

Runs build_recovery() from legacy/gym_tracker.py on the two anonymised sample CSVs, as of
12 Nov 2026, and keeps the days and status of every pattern and muscle. The app's recovery
test compares domain/recovery.ts with this file, so the two implementations can't drift.

Run it from the repo root when the sample or the legacy logic changes:
    python tests/golden/make_recovery_golden.py
"""
import datetime as dt
import importlib.util
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
FIXTURES = ROOT / "tests" / "fixtures"
OUT = ROOT / "domain" / "__tests__" / "fixtures" / "recovery-golden.json"
TODAY = dt.date(2026, 11, 12)

spec = importlib.util.spec_from_file_location("gym_tracker", ROOT / "legacy" / "gym_tracker.py")
gym_tracker = importlib.util.module_from_spec(spec)
spec.loader.exec_module(gym_tracker)
gym_tracker.read_priorities = lambda: []  # the owner's priorities file is not part of the test


def parse(markdown):
    """The two tables of build_recovery: '| name | last | days | status |' rows per section."""
    sections, current = {}, None
    for line in markdown.splitlines():
        if line.startswith("## "):
            current = {"Movement patterns": "patterns", "Muscles": "muscles"}.get(line[3:].strip())
            if current:
                sections[current] = {}
            continue
        if current is None or not line.startswith("| ") or line.startswith("|---"):
            continue
        name, last, days, status = [c.strip() for c in line.strip("|").split("|")]
        if name in ("Pattern", "Muscle"):
            continue  # the header row
        sections[current][name] = {
            "last": None if last == "never" else last,
            "days": None if days == "-" else int(days),
            "status": status,
        }
    return sections


def main():
    sessions = gym_tracker.read_rows(FIXTURES / "sessions-sample.csv")
    exercises = gym_tracker.read_rows(FIXTURES / "exercises-sample.csv")
    golden = {"today": TODAY.isoformat(), **parse(gym_tracker.build_recovery(sessions, exercises, TODAY))}
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(golden, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"wrote {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
