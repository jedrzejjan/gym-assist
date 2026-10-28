#!/usr/bin/env python3
"""Gym tracker: log visits and sets, then rebuild the reports.

Usage:
  python gym_tracker.py visit [YYYY-MM-DD]
  python gym_tracker.py set EXERCISE [WEIGHT_KG REPS] [--set N] [--side L|P|per side] [--date YYYY-MM-DD]
                            [--category CAT] [--muscles LIST] [--pattern PATTERN] [--training TYPE] [--pl NAME]
                            [--height CM] [--speed KMH --minutes MIN] [--note TEXT]
  python gym_tracker.py report              rebuild every file in reports/
  python gym_tracker.py status              recovery by movement pattern and muscle, plus priorities
  python gym_tracker.py last [N]            most recently trained exercises (default 10)
  python gym_tracker.py pattern PATTERN     exercises for one movement pattern
  python gym_tracker.py curve EXERCISE      progress chart as SVG in reports/curves/

Data (edit only to fix a mistake):
  data/visits.csv      one row per gym visit
  data/sessions.csv    one row per set
  data/exercises.csv   exercise list with category, training type, movement pattern and muscles
Priorities: config/priorities.txt (one muscle per line, or "exercise: NAME").
Reports in reports/ are generated. Do not edit them by hand.
Training types: Strength (default), Plyometric (jumps), Power (e.g. med ball slam), Cardio.
Box jumps are measured by box height (--height in cm), not by weight.
"""
import argparse
import calendar
import csv
import datetime as dt
import html
import re
import zipfile
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DATA = ROOT / "data"
CONFIG = ROOT / "config"
REPORTS = ROOT / "reports"
CURVES = REPORTS / "curves"
VISITS = DATA / "visits.csv"
SESSIONS = DATA / "sessions.csv"
EXERCISES = DATA / "exercises.csv"
PRIORITIES = CONFIG / "priorities.txt"

SESSION_FIELDS = ["date", "exercise_en", "set_no", "side", "weight_kg", "reps", "height_cm", "speed_kmh", "minutes", "note"]
EXERCISE_FIELDS = ["exercise_en", "exercise_pl", "category", "training", "pattern", "muscles", "muscles_pl", "muscles_la"]

CATEGORIES = ["Knee dominant", "Hip dominant", "Push", "Pull", "Core"]
CATEGORY_ALIASES = {"kd": "Knee dominant", "hd": "Hip dominant"}
TRAINING_TYPES = ["Strength", "Plyometric", "Power", "Cardio"]
PATTERNS = ["KD", "HD", "Push vertical", "Push horizontal", "Pull vertical", "Pull horizontal",
            "Anti flexion", "Anti extension", "Carries"]
PATTERN_ALIASES = {"kd": "KD", "hd": "HD"}
SIDES = {
    "": "", "l": "L", "left": "L", "lewa": "L",
    "p": "P", "r": "P", "right": "P", "prawa": "P",
    "per side": "per side", "strona": "per side", "per leg": "per side",
}
MUSCLES = [
    "quadriceps", "hamstrings", "glutes", "adductors", "calves", "core",
    "chest", "shoulders", "triceps", "biceps", "lats", "upper back",
]
# English key -> (Polish name, Latin name)
MUSCLE_NAMES = {
    "quadriceps": ("mięsień czworogłowy uda", "musculus quadriceps femoris"),
    "hamstrings": ("mięśnie kulszowo-goleniowe", "musculi ischiocrurales"),
    "glutes": ("mięśnie pośladkowe", "musculi gluteales"),
    "adductors": ("mięśnie przywodziciele", "musculi adductores"),
    "calves": ("mięśnie łydki", "musculi surae"),
    "core": ("mięśnie tułowia (core)", "musculi trunci"),
    "chest": ("mięsień piersiowy większy", "musculus pectoralis major"),
    "shoulders": ("mięśnie barku", "musculi deltoidei"),
    "triceps": ("mięsień trójgłowy ramienia", "musculus triceps brachii"),
    "biceps": ("mięsień dwugłowy ramienia", "musculus biceps brachii"),
    "lats": ("mięsień najszerszy grzbietu", "musculus latissimus dorsi"),
    "upper back": ("mięśnie górnej części pleców", "musculus trapezius, musculi rhomboidei"),
}


# ---------- files and parsing ----------

def read_rows(path):
    if not path.exists():
        return []
    with path.open(newline="", encoding="utf-8-sig") as f:
        return list(csv.DictReader(f))


def append_row(path, fields, row):
    path.parent.mkdir(parents=True, exist_ok=True)
    is_new = not path.exists()
    with path.open("a", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fields)
        if is_new:
            writer.writeheader()
        writer.writerow(row)


def write_text(path, text):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def parse_date(text):
    return dt.date.fromisoformat(text) if text else dt.date.today()


def normalize_category(text):
    key = text.strip().casefold()
    if key in CATEGORY_ALIASES:
        return CATEGORY_ALIASES[key]
    for category in CATEGORIES:
        if category.casefold() == key:
            return category
    raise SystemExit(f"Unknown category '{text}'. Use one of: {', '.join(CATEGORIES)} (or KD / HD).")


def normalize_training(text):
    for training in TRAINING_TYPES:
        if training.casefold() == text.strip().casefold():
            return training
    raise SystemExit(f"Unknown training type '{text}'. Use one of: {', '.join(TRAINING_TYPES)}.")


def normalize_pattern(text):
    key = text.strip().casefold()
    if key in PATTERN_ALIASES:
        return PATTERN_ALIASES[key]
    for pattern in PATTERNS:
        if pattern.casefold() == key:
            return pattern
    raise SystemExit(f"Unknown pattern '{text}'. Use one of: {', '.join(PATTERNS)} (or KD / HD).")


def normalize_muscles(text):
    """Accepts 'hamstrings;glutes' or 'hamstrings, glutes' and returns the canonical names."""
    found = []
    for part in text.replace(",", ";").split(";"):
        key = part.strip().casefold()
        if not key:
            continue
        match = next((m for m in MUSCLES if m == key), None)
        if match is None:
            raise SystemExit(f"Unknown muscle '{part.strip()}'. Use one of: {', '.join(MUSCLES)}.")
        if match not in found:
            found.append(match)
    return found


def normalize_side(text):
    if text is None:
        return ""
    key = text.strip().casefold()
    if key not in SIDES:
        raise SystemExit(f"Unknown side '{text}'. Use L, P or 'per side'.")
    return SIDES[key]


def find_exercise(exercises, name):
    key = name.strip().casefold()
    for exercise in exercises:
        if key in (exercise["exercise_en"].casefold(), exercise["exercise_pl"].casefold()):
            return exercise
    return None


def muscles_of(exercise):
    return [m for m in exercise.get("muscles", "").split(";") if m]


# ---------- numbers ----------

def est_1rm(weight, reps):
    """Epley estimate of a one-rep max."""
    return weight if reps == 1 else weight * (1 + reps / 30)


def best_key(row):
    """Sort key: speed and duration for cardio, box height for box jumps, estimated 1RM otherwise.
    Bodyweight sets (0 kg) compare on reps."""
    if row["speed_kmh"]:
        return (float(row["speed_kmh"]), float(row["minutes"] or 0))
    if row["height_cm"]:
        return (float(row["height_cm"]), int(row["reps"] or 0))
    weight = float(row["weight_kg"] or 0)
    reps = int(row["reps"] or 0)
    return (est_1rm(weight, reps), reps)


def shown_weight(row):
    """Weight as text; '-' when the weight was not recorded."""
    return f"{float(row['weight_kg']):g} kg" if row["weight_kg"] else "- kg"


def shown_reps(row):
    """Reps as text; '-' when the reps were not recorded."""
    return row["reps"] or "-"


def fmt_row(row):
    if row["speed_kmh"]:
        return f"{float(row['speed_kmh']):g} km/h x {float(row['minutes']):g} min"
    if row["height_cm"]:
        return f"{float(row['height_cm']):g} cm box x {shown_reps(row)}"
    text = f"{shown_weight(row)} x {shown_reps(row)}"
    return f"{text} ({row['side']})" if row["side"] else text


def progress_note(prev, new):
    """Describe how a new set compares with the previous max."""
    if new["speed_kmh"]:
        d_speed = float(new["speed_kmh"]) - float(prev["speed_kmh"])
        d_min = float(new["minutes"]) - float(prev["minutes"])
        parts = []
        if d_speed:
            parts.append(f"speed {d_speed:+g} km/h")
        if d_min:
            parts.append(f"duration {d_min:+g} min")
        return ", ".join(parts) or "same speed and duration as the previous max"
    if new["height_cm"]:
        if not prev["height_cm"]:
            return "no previous box height to compare"
        d_height = float(new["height_cm"]) - float(prev["height_cm"])
        d_reps = int(new["reps"] or 0) - int(prev["reps"] or 0)
        return f"height {d_height:+g} cm, reps {d_reps:+d}"
    if not new["weight_kg"] or not new["reps"] or not prev["weight_kg"] or not prev["reps"]:
        return "weight or reps not recorded, so no comparison"
    d_weight = float(new["weight_kg"]) - float(prev["weight_kg"])
    d_reps = int(new["reps"]) - int(prev["reps"])
    if d_weight:
        return f"weight {d_weight:+g} kg"
    if d_reps:
        return f"{d_reps:+d} reps at the same weight"
    return "same weight and reps as the previous max"


def session_text(rows):
    """All sets of one exercise on one day, in set order."""
    return "; ".join(fmt_row(r) for r in sorted(rows, key=lambda r: (int(r["set_no"]), r["side"])))


def recovery_label(days):
    if days < 2:
        return "recovering, too soon"
    if days <= 3:
        return "in supercompensation window (48-72 h)"
    return "due"


def last_dates(rows, keys_of):
    """Most recent date each key was trained, where keys_of(row) gives the keys a row counts for."""
    last = {}
    for row in rows:
        day = dt.date.fromisoformat(row["date"])
        for key in keys_of(row):
            if key not in last or day > last[key]:
                last[key] = day
    return last


def read_priorities():
    if not PRIORITIES.exists():
        return []
    lines = [line.strip() for line in PRIORITIES.read_text(encoding="utf-8-sig").splitlines()]
    return [line for line in lines if line and not line.startswith("#")]


# ---------- commands: logging ----------

def cmd_visit(args):
    day = parse_date(args.date).isoformat()
    if any(r["date"] == day for r in read_rows(VISITS)):
        print(f"Visit on {day} is already logged.")
        return
    append_row(VISITS, ["date"], {"date": day})
    print(f"Logged gym visit on {day}.")


def cmd_set(args):
    exercises = read_rows(EXERCISES)
    sessions = read_rows(SESSIONS)
    name = args.exercise.strip()
    exercise = find_exercise(exercises, name)

    if exercise is None:
        if not args.category or not args.muscles:
            raise SystemExit(f"'{name}' is a new exercise. Add --category (KD, HD, Push, Pull, Core) and --muscles.")
        muscles = normalize_muscles(args.muscles)
        exercise = {
            "exercise_en": name,
            "exercise_pl": args.pl or "",
            "category": normalize_category(args.category),
            "training": normalize_training(args.training) if args.training else "Strength",
            "pattern": normalize_pattern(args.pattern) if args.pattern else "none",
            "muscles": ";".join(muscles),
            "muscles_pl": ";".join(MUSCLE_NAMES[m][0] for m in muscles),
            "muscles_la": ";".join(MUSCLE_NAMES[m][1] for m in muscles),
        }
        append_row(EXERCISES, EXERCISE_FIELDS, exercise)
        print(f"Added '{name}' to exercises.csv.")

    training = exercise["training"]
    if training == "Cardio":
        if not args.speed or not args.minutes:
            raise SystemExit("Cardio needs --speed (km/h) and --minutes.")
        weight, reps = "", ""
    else:
        # Weight or reps may be unknown; they are stored blank and shown as '?'.
        if args.reps is not None and int(args.reps) < 1:
            raise SystemExit("Reps must be at least 1.")
        if args.weight is not None and float(args.weight) < 0:
            raise SystemExit("Weight cannot be negative.")
        weight = "" if args.weight is None else f"{float(args.weight):g}"
        reps = "" if args.reps is None else str(int(args.reps))

    day = parse_date(args.date).isoformat()
    side = normalize_side(args.side)
    same_day = [r for r in sessions if r["date"] == day and r["exercise_en"] == exercise["exercise_en"]]
    if args.set:
        set_no = int(args.set)
    elif not same_day:
        set_no = 1
    else:
        top = max(int(r["set_no"]) for r in same_day)
        taken = any(int(r["set_no"]) == top and r["side"] == side for r in same_day)
        set_no = top + 1 if taken else top

    prior = [r for r in sessions if r["exercise_en"] == exercise["exercise_en"]]
    prev = max(prior, key=best_key) if prior else None
    row = {
        "date": day,
        "exercise_en": exercise["exercise_en"],
        "set_no": str(set_no),
        "side": side,
        "weight_kg": weight,
        "reps": reps,
        "height_cm": f"{float(args.height):g}" if args.height else "",
        "speed_kmh": f"{float(args.speed):g}" if args.speed else "",
        "minutes": f"{float(args.minutes):g}" if args.minutes else "",
        "note": args.note,
    }
    append_row(SESSIONS, SESSION_FIELDS, row)

    print(f"Logged {exercise['exercise_en']}, set {set_no}: {fmt_row(row)} on {day}.")
    if prev is None:
        print("First logged set for this exercise, so there is no previous max to compare.")
    else:
        print(f"Previous max: {fmt_row(prev)} ({prev['date']}).")
        print(f"Progress: {progress_note(prev, row)}.")
        if best_key(row) > best_key(prev):
            print("This is a new max.")


# ---------- reports ----------

def build_calendar(visits, sessions):
    """Calendar of visits (✔) and training days (●), plus a list of what was trained on each day."""
    trained = defaultdict(list)
    for row in sessions:
        names = trained[dt.date.fromisoformat(row["date"])]
        if row["exercise_en"] not in names:
            names.append(row["exercise_en"])
    visited = {dt.date.fromisoformat(v) for v in visits}
    lines = [
        "# Gym calendar", "",
        f"Total visits: {len(visited)}. Training days: {len(trained)}.", "",
        "✔ = visit logged. ● = training logged, visit not confirmed.", "",
    ]
    if not visited and not trained:
        return "\n".join(lines + ["No visits or training logged yet."]) + "\n"

    days = visited | set(trained)
    first = min(days).replace(day=1)
    last = max(max(days), dt.date.today()).replace(day=1)
    year, month = first.year, first.month

    while (year, month) <= (last.year, last.month):
        count = sum(1 for d in visited if d.year == year and d.month == month)
        lines += [
            f"## {calendar.month_name[month]} {year} ({count} visits)",
            "",
            "| Mon | Tue | Wed | Thu | Fri | Sat | Sun |",
            "|---|---|---|---|---|---|---|",
        ]
        for week in calendar.Calendar(firstweekday=0).monthdayscalendar(year, month):
            cells = []
            for day in week:
                if day == 0:
                    cells.append("")
                    continue
                current = dt.date(year, month, day)
                if current in visited:
                    cells.append(f"**{day} ✔**")
                elif current in trained:
                    cells.append(f"**{day} ●**")
                else:
                    cells.append(str(day))
            lines.append("| " + " | ".join(cells) + " |")
        lines.append("")
        year, month = (year + 1, 1) if month == 12 else (year, month + 1)

    lines += ["## Training log", ""]
    for day in sorted(trained):
        status = "visit logged" if day in visited else "visit not confirmed"
        lines.append(f"- {day.isoformat()} ({status}): {', '.join(trained[day])}")
    return "\n".join(lines) + "\n"


def build_progress(sessions, exercises):
    lines = [
        "# Progress",
        "",
        "Best = highest estimated 1RM (Epley: weight x (1 + reps / 30)); bodyweight sets compare on reps.",
        "Box jumps: best = highest box height (cm), so no 1RM is shown.",
        "",
    ]
    if not sessions:
        return "\n".join(lines + ["No sets logged yet."]) + "\n"

    by_name = defaultdict(list)
    for row in sessions:
        by_name[row["exercise_en"]].append(row)

    for training in TRAINING_TYPES:
        in_type = [e for e in exercises if e["training"] == training and e["exercise_en"] in by_name]
        if not in_type:
            continue
        lines += [f"## {training} training", ""]
        for category in CATEGORIES:
            group = sorted((e for e in in_type if e["category"] == category), key=lambda e: e["exercise_en"].casefold())
            if not group:
                continue
            lines += [
                f"### {category}",
                "",
                "| Exercise | Pattern | Muscles | Sessions | Best set | Best est. 1RM | Last session |",
                "|---|---|---|---|---|---|---|",
            ]
            for exercise in group:
                rows = by_name[exercise["exercise_en"]]
                best = max(rows, key=best_key)
                last_day = max(r["date"] for r in rows)
                sessions_count = len({r["date"] for r in rows})
                label = f"{exercise['exercise_en']} / {exercise['exercise_pl']}" if exercise["exercise_pl"] else exercise["exercise_en"]
                if training == "Cardio" or best["height_cm"]:
                    one_rm = "-"
                else:
                    one_rm = f"{est_1rm(float(best['weight_kg'] or 0), int(best['reps'] or 0)):.1f} kg"
                last_rows = [r for r in rows if r["date"] == last_day]
                lines.append(
                    f"| {label} | {exercise['pattern']} | {', '.join(muscles_of(exercise)) or '-'} | {sessions_count} | "
                    f"{fmt_row(best)} ({best['date']}) | {one_rm} | {last_day}: {session_text(last_rows)} |"
                )
            lines.append("")
    return "\n".join(lines) + "\n"


def build_catalogue(exercises):
    lines = ["# Training catalogue", "", "One row per exercise. Source: data/exercises.csv.", ""]
    for training in TRAINING_TYPES:
        in_type = [e for e in exercises if e["training"] == training]
        if not in_type:
            continue
        lines += [f"## {training} training", ""]
        for category in CATEGORIES:
            group = sorted((e for e in in_type if e["category"] == category), key=lambda e: e["exercise_en"].casefold())
            if not group:
                continue
            lines += [
                f"### {category}", "",
                "| Exercise | Pattern | Muscles | Muscles (PL) | Muscles (LA) |",
                "|---|---|---|---|---|",
            ]
            for e in group:
                label = f"{e['exercise_en']} / {e['exercise_pl']}" if e["exercise_pl"] else e["exercise_en"]
                lines.append(f"| {label} | {e['pattern']} | {', '.join(muscles_of(e))} | {e['muscles_pl'].replace(';', ', ')} | {e['muscles_la'].replace(';', ', ')} |")
            lines.append("")
    return "\n".join(lines) + "\n"


def cell_text(rows):
    """One cell of the session log: all rows of one set, e.g. '54 kg x L6 / P8' or '47 kg x 9 (per side)'."""
    if not rows:
        return ""
    first = rows[0]
    if first["speed_kmh"]:
        return fmt_row(first)
    if first["height_cm"]:
        return f"{float(first['height_cm']):g} cm box x {shown_reps(first)}"
    weight = shown_weight(first)
    sides = {r["side"] for r in rows}
    if sides <= {"L", "P"} and sides != {""}:
        return f"{weight} x " + " / ".join(f"{r['side']}{shown_reps(r)}" for r in sorted(rows, key=lambda r: r["side"]))
    suffix = " / strona" if "per side" in sides else ""
    return f"{weight} x {shown_reps(first)}{suffix}"


def session_log_rows(sessions, exercises):
    """Rows for the session workbook: a banner row per training day, then one row per exercise."""
    by_key = defaultdict(list)
    order = []
    for row in sessions:
        key = (row["date"], row["exercise_en"])
        if key not in by_key:
            order.append(key)
        by_key[key].append(row)
    exercise_by_name = {e["exercise_en"]: e for e in exercises}
    max_sets = max((int(r["set_no"]) for r in sessions), default=1)
    width = 5 + max_sets + 2

    rows, merges = [], []
    header = ["Data", "Kategoria", "Typ", "Ćwiczenie (EN)", "Ćwiczenie (PL)"] + [f"Seria {i}" for i in range(1, max_sets + 1)] + ["Mięśnie", "Uwagi"]
    rows.append([(h, "header") for h in header])
    for day in sorted({k[0] for k in order}):
        day_keys = [k for k in order if k[0] == day]
        set_count = sum(len(by_key[k]) for k in day_keys)
        merges.append((len(rows) + 1, width))
        rows.append([(f"{day}  ·  {len(day_keys)} ćwiczeń, {set_count} serii", "banner")] + [("", "banner")] * (width - 1))
        for key in day_keys:
            name = key[1]
            srows = by_key[key]
            exercise = exercise_by_name[name]
            cells = [cell_text([r for r in srows if int(r["set_no"]) == i]) for i in range(1, max_sets + 1)]
            notes = "; ".join(dict.fromkeys(r["note"] for r in srows if r["note"]))
            values = [day, exercise["category"], exercise["training"], name, exercise["exercise_pl"]] + cells + [", ".join(muscles_of(exercise)), notes]
            rows.append([(v, "body") for v in values])
        rows.append([])
    return rows, merges, width


def session_legend_rows():
    return [
        [("Kolumna", "header"), ("Znaczenie", "header")],
        [("Data", "body"), ("Data treningu (RRRR-MM-DD). Pasek z datą oddziela dni treningowe.", "body")],
        [("Kategoria", "body"), ("KD, HD, Push, Pull, Core albo Cardio.", "body")],
        [("Typ", "body"), ("Strength, Plyometric, Power albo Cardio.", "body")],
        [("Seria 1-N", "body"), ("Jedna kolumna na serię. Format: ciężar × powtórzenia. 'L' i 'P' = lewa i prawa noga. '/ strona' = powtórzenia na stronę.", "body")],
        [("Mięśnie", "body"), ("Pracujące mięśnie (EN).", "body")],
        [("Uwagi", "body"), ("Komentarze z treningu i założenia.", "body")],
        [("Źródło", "body"), ("Generowane z data/sessions.csv. Nie edytować ręcznie.", "body")],
    ]


def col_letter(index):
    """0-based column index to Excel letters (0 -> A, 26 -> AA)."""
    letters = ""
    index += 1
    while index:
        index, rem = divmod(index - 1, 26)
        letters = chr(65 + rem) + letters
    return letters


def sheet_xml(rows, widths, merges, styles):
    """Worksheet XML with inline strings. styles maps a style name to its cellXfs index."""
    body = []
    for r_index, row in enumerate(rows, start=1):
        cells = []
        for c_index, (value, kind) in enumerate(row):
            ref = f"{col_letter(c_index)}{r_index}"
            style = styles[kind]
            text = html.escape(str(value), quote=False)
            if text == "":
                cells.append(f'<c r="{ref}" s="{style}"/>')
            else:
                cells.append(f'<c r="{ref}" s="{style}" t="inlineStr"><is><t xml:space="preserve">{text}</t></is></c>')
        body.append(f'<row r="{r_index}">{"".join(cells)}</row>' if cells else f'<row r="{r_index}"/>')
    cols = "".join(f'<col min="{i}" max="{i}" width="{w}" customWidth="1"/>' for i, w in enumerate(widths, start=1))
    merge_xml = ""
    if merges:
        merge_xml = f'<mergeCells count="{len(merges)}">' + "".join(
            f'<mergeCell ref="A{r}:{col_letter(c - 1)}{r}"/>' for r, c in merges) + "</mergeCells>"
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
        'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
        '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>'
        f'<cols>{cols}</cols><sheetData>{"".join(body)}</sheetData>{merge_xml}'
        '<pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/>'
        '</worksheet>'
    )


def write_session_xlsx(path, sessions, exercises):
    """Writes the session workbook with the standard library only (an .xlsx file is a zip of XML parts)."""
    rows, merges, width = session_log_rows(sessions, exercises)
    widths = [12, 13, 12, 30, 40] + [24] * (width - 7) + [30, 45]
    styles = {"body": 0, "header": 1, "banner": 2}
    sheets = [
        ("Sesje", sheet_xml(rows, widths, merges, styles)),
        ("Legenda", sheet_xml(session_legend_rows(), [14, 90], [], styles)),
    ]
    content_types = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
        '<Default Extension="xml" ContentType="application/xml"/>'
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
        + "".join(f'<Override PartName="/xl/worksheets/sheet{i}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' for i in range(1, len(sheets) + 1))
        + '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
        '</Types>'
    )
    root_rels = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
        '</Relationships>'
    )
    workbook = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
        'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
        '<sheets>' + "".join(f'<sheet name="{name}" sheetId="{i}" r:id="rId{i}"/>' for i, (name, _) in enumerate(sheets, start=1)) + '</sheets>'
        '</workbook>'
    )
    n = len(sheets)
    workbook_rels = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        + "".join(f'<Relationship Id="rId{i}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet{i}.xml"/>' for i in range(1, n + 1))
        + f'<Relationship Id="rId{n + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
        '</Relationships>'
    )
    styles_xml = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
        '<fonts count="3">'
        '<font><sz val="10"/><name val="Arial"/></font>'
        '<font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Arial"/></font>'
        '<font><b/><sz val="10"/><color rgb="FF1F4E78"/><name val="Arial"/></font>'
        '</fonts>'
        '<fills count="4">'
        '<fill><patternFill patternType="none"/></fill>'
        '<fill><patternFill patternType="gray125"/></fill>'
        '<fill><patternFill patternType="solid"><fgColor rgb="FF1F4E78"/><bgColor indexed="64"/></patternFill></fill>'
        '<fill><patternFill patternType="solid"><fgColor rgb="FFD9E1F2"/><bgColor indexed="64"/></patternFill></fill>'
        '</fills>'
        '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>'
        '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
        '<cellXfs count="3">'
        '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>'
        '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>'
        '<xf numFmtId="0" fontId="2" fillId="3" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center"/></xf>'
        '</cellXfs>'
        '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>'
        '</styleSheet>'
    )
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("[Content_Types].xml", content_types)
        z.writestr("_rels/.rels", root_rels)
        z.writestr("xl/workbook.xml", workbook)
        z.writestr("xl/_rels/workbook.xml.rels", workbook_rels)
        z.writestr("xl/styles.xml", styles_xml)
        for i, (_, xml) in enumerate(sheets, start=1):
            z.writestr(f"xl/worksheets/sheet{i}.xml", xml)


def build_recovery(sessions, exercises, today):
    by_name = {e["exercise_en"]: e for e in exercises}
    by_pattern = last_dates(sessions, lambda r: [by_name[r["exercise_en"]]["pattern"]] if r["exercise_en"] in by_name else [])
    by_muscle = last_dates(sessions, lambda r: muscles_of(by_name[r["exercise_en"]]) if r["exercise_en"] in by_name else [])
    by_exercise = last_dates(sessions, lambda r: [r["exercise_en"]])

    lines = [f"# Recovery as of {today.isoformat()}", "",
             "## Movement patterns", "",
             "| Pattern | Last trained | Days ago | Status |", "|---|---|---|---|"]
    for pattern in PATTERNS:
        day = by_pattern.get(pattern)
        if day is None:
            lines.append(f"| {pattern} | never | - | never logged |")
        else:
            days = (today - day).days
            lines.append(f"| {pattern} | {day.isoformat()} | {days} | {recovery_label(days)} |")

    lines += ["", "## Muscles", "", "| Muscle | Last trained | Days ago | Status |", "|---|---|---|---|"]
    for muscle in MUSCLES:
        day = by_muscle.get(muscle)
        if day is None:
            lines.append(f"| {muscle} | never | - | never logged |")
        else:
            days = (today - day).days
            lines.append(f"| {muscle} | {day.isoformat()} | {days} | {recovery_label(days)} |")

    priorities = read_priorities()
    if priorities:
        lines += ["", "## Priorities", ""]
        for number, item in enumerate(priorities, start=1):
            if item.casefold().startswith("exercise:"):
                name = item.split(":", 1)[1].strip()
                day = by_exercise.get(name)
                label = f"{number}. {name} (exercise)"
            elif item.casefold() in MUSCLES:
                day = by_muscle.get(item.casefold())
                label = f"{number}. {item}"
            else:
                lines.append(f"- {number}. {item}: not tracked by the script yet")
                continue
            if day is None:
                lines.append(f"- {label}: never logged")
            else:
                days = (today - day).days
                lines.append(f"- {label}: {days} day(s) ago (last {day.isoformat()}) - {recovery_label(days)}")
    return "\n".join(lines) + "\n"


def cmd_report(_args):
    visits = sorted({r["date"] for r in read_rows(VISITS)})
    sessions = read_rows(SESSIONS)
    exercises = read_rows(EXERCISES)
    today = dt.date.today()
    write_text(REPORTS / "gym-calendar.md", build_calendar(visits, sessions))
    write_text(REPORTS / "progress.md", build_progress(sessions, exercises))
    write_session_xlsx(REPORTS / "session-log.xlsx", sessions, exercises)
    write_text(REPORTS / "training-catalogue.md", build_catalogue(exercises))
    write_text(REPORTS / "recovery.md", build_recovery(sessions, exercises, today))
    print(f"Updated reports/. Visits: {len(visits)}, logged sets: {len(sessions)}, exercises: {len(exercises)}.")


# ---------- commands: questions ----------

def cmd_status(_args):
    sessions = read_rows(SESSIONS)
    exercises = read_rows(EXERCISES)
    print(build_recovery(sessions, exercises, dt.date.today()), end="")


def cmd_last(args):
    sessions = read_rows(SESSIONS)
    by_name = defaultdict(list)
    for row in sessions:
        by_name[row["exercise_en"]].append(row)
    ranked = sorted(by_name.items(), key=lambda kv: max(r["date"] for r in kv[1]), reverse=True)
    if not ranked:
        print("No sets logged yet.")
        return
    for name, rows in ranked[: args.n]:
        last_day = max(r["date"] for r in rows)
        print(f"{last_day}  {name}: {session_text([r for r in rows if r['date'] == last_day])}")


def cmd_pattern(args):
    pattern = normalize_pattern(args.pattern)
    exercises = [e for e in read_rows(EXERCISES) if e["pattern"] == pattern]
    sessions = read_rows(SESSIONS)
    if not exercises:
        print(f"No exercises mapped to {pattern} yet.")
        return
    print(f"# {pattern}")
    for e in sorted(exercises, key=lambda e: e["exercise_en"].casefold()):
        rows = [r for r in sessions if r["exercise_en"] == e["exercise_en"]]
        if not rows:
            print(f"- {e['exercise_en']}: never logged")
            continue
        last_day = max(r["date"] for r in rows)
        print(f"- {e['exercise_en']} / {e['exercise_pl']}: last {last_day}, {len({r['date'] for r in rows})} session(s)")


def curve_points(rows):
    """One point per session: best set of that day, as (date, value, unit)."""
    by_day = defaultdict(list)
    for row in rows:
        by_day[row["date"]].append(row)
    points = []
    for day, day_rows in sorted(by_day.items()):
        best = max(day_rows, key=best_key)
        if best["speed_kmh"]:
            points.append((dt.date.fromisoformat(day), float(best["speed_kmh"]), "km/h"))
        elif best["height_cm"]:
            points.append((dt.date.fromisoformat(day), float(best["height_cm"]), "cm"))
        elif any(float(r["weight_kg"] or 0) > 0 for r in rows):
            points.append((dt.date.fromisoformat(day), est_1rm(float(best["weight_kg"] or 0), int(best["reps"] or 0)), "kg est. 1RM"))
        else:
            points.append((dt.date.fromisoformat(day), float(best["reps"] or 0), "reps"))
    return points


def svg_curve(title, points):
    width, height = 720, 420
    left, right, top, bottom = 70, 30, 50, 60
    dates = [p[0] for p in points]
    values = [p[1] for p in points]
    unit = points[0][2]
    x0, x1 = min(dates), max(dates)
    span = max((x1 - x0).days, 1)
    y0, y1 = min(values), max(values)
    if y0 == y1:
        y0, y1 = y0 - 1, y1 + 1
    pad = (y1 - y0) * 0.1
    y0, y1 = max(0, y0 - pad), y1 + pad

    def px(day):
        if x1 == x0:
            return left + (width - left - right) / 2
        return left + (day - x0).days / span * (width - left - right)

    def py(value):
        return height - bottom - (value - y0) / (y1 - y0) * (height - top - bottom)

    parts = [
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" width="{width}" height="{height}" font-family="Arial, sans-serif">',
        f'<rect width="{width}" height="{height}" fill="white"/>',
        f'<text x="{left}" y="30" font-size="18" font-weight="bold">{html.escape(title)}</text>',
        f'<line x1="{left}" y1="{top}" x2="{left}" y2="{height - bottom}" stroke="#333"/>',
        f'<line x1="{left}" y1="{height - bottom}" x2="{width - right}" y2="{height - bottom}" stroke="#333"/>',
    ]
    for i in range(5):
        value = y0 + (y1 - y0) * i / 4
        y = py(value)
        parts.append(f'<line x1="{left}" y1="{y:.1f}" x2="{width - right}" y2="{y:.1f}" stroke="#eee"/>')
        parts.append(f'<text x="{left - 8}" y="{y + 4:.1f}" font-size="11" text-anchor="end">{value:.1f}</text>')
    parts.append(f'<text x="{left}" y="{top - 12}" font-size="12">{html.escape(unit)}</text>')
    parts.append(f'<text x="{left}" y="{height - bottom + 20}" font-size="11">{dates[0].isoformat()}</text>')
    if x1 != x0:
        parts.append(f'<text x="{width - right}" y="{height - bottom + 20}" font-size="11" text-anchor="end">{dates[-1].isoformat()}</text>')
    coords = [(px(d), py(v)) for d, v, _ in points]
    if len(coords) > 1:
        path = " ".join(f"{x:.1f},{y:.1f}" for x, y in coords)
        parts.append(f'<polyline points="{path}" fill="none" stroke="#1f4e78" stroke-width="2"/>')
    for (x, y), (d, v, u) in zip(coords, points):
        parts.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="4" fill="#1f4e78"><title>{d.isoformat()}: {v:.1f} {html.escape(u)}</title></circle>')
    parts.append("</svg>")
    return "\n".join(parts) + "\n"


def cmd_curve(args):
    exercises = read_rows(EXERCISES)
    exercise = find_exercise(exercises, args.exercise)
    if exercise is None:
        raise SystemExit(f"'{args.exercise}' is not in exercises.csv.")
    sessions = [r for r in read_rows(SESSIONS) if r["exercise_en"] == exercise["exercise_en"]]
    points = curve_points(sessions)
    if not points:
        raise SystemExit(f"No sets logged for '{exercise['exercise_en']}' yet.")
    slug = re.sub(r"[^a-z0-9]+", "-", exercise["exercise_en"].casefold()).strip("-")
    path = CURVES / f"{slug}.svg"
    write_text(path, svg_curve(exercise["exercise_en"], points))
    print(f"Wrote {path.relative_to(ROOT)} ({len(points)} session(s)).")


# ---------- entry point ----------

def main():
    parser = argparse.ArgumentParser(description="Gym visit and set tracker")
    sub = parser.add_subparsers(dest="command", required=True)

    p_visit = sub.add_parser("visit", help="log a gym visit")
    p_visit.add_argument("date", nargs="?", help="YYYY-MM-DD (default: today)")
    p_visit.set_defaults(func=cmd_visit)

    p_set = sub.add_parser("set", help="log one set of an exercise")
    p_set.add_argument("exercise")
    p_set.add_argument("weight", nargs="?", help="weight in kg (0 for bodyweight); not used for cardio")
    p_set.add_argument("reps", nargs="?", help="reps; not used for cardio")
    p_set.add_argument("--set", help="set number (default: next set of that exercise on that day)")
    p_set.add_argument("--side", help="L, P or 'per side' for unilateral work")
    p_set.add_argument("--speed", help="cardio speed in km/h")
    p_set.add_argument("--minutes", help="cardio duration in minutes")
    p_set.add_argument("--height", help="box height in cm (for box jumps)")
    p_set.add_argument("--date", help="YYYY-MM-DD (default: today)")
    p_set.add_argument("--category", help="required for new exercises")
    p_set.add_argument("--muscles", help="required for new exercises, e.g. 'hamstrings;glutes'")
    p_set.add_argument("--pattern", help="movement pattern for new exercises (KD, HD, Push vertical, ...)")
    p_set.add_argument("--training", help="Strength, Plyometric, Power or Cardio (default: Strength)")
    p_set.add_argument("--pl", help="Polish exercise name (for new exercises)")
    p_set.add_argument("--note", default="")
    p_set.set_defaults(func=cmd_set)

    p_report = sub.add_parser("report", help="rebuild the files in reports/")
    p_report.set_defaults(func=cmd_report)

    p_status = sub.add_parser("status", help="recovery by movement pattern and muscle, plus priorities")
    p_status.set_defaults(func=cmd_status)

    p_last = sub.add_parser("last", help="most recently trained exercises")
    p_last.add_argument("n", nargs="?", type=int, default=10)
    p_last.set_defaults(func=cmd_last)

    p_pattern = sub.add_parser("pattern", help="exercises for one movement pattern")
    p_pattern.add_argument("pattern")
    p_pattern.set_defaults(func=cmd_pattern)

    p_curve = sub.add_parser("curve", help="progress chart for one exercise (SVG)")
    p_curve.add_argument("exercise")
    p_curve.set_defaults(func=cmd_curve)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
