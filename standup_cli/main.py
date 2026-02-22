#!/usr/bin/env python3

import argparse
import json
import os
import re
import shutil
import subprocess
import sys

# ANSI colors
RESET = "\x1b[0m"
BOLD = "\x1b[1m"
DIM = "\x1b[2m"
CYAN = "\x1b[36m"
GREEN = "\x1b[32m"
YELLOW = "\x1b[33m"
MAGENTA = "\x1b[35m"
GRAY = "\x1b[90m"

TYPE_ORDER = [
    "feat",
    "fix",
    "refactor",
    "perf",
    "docs",
    "test",
    "chore",
    "build",
    "ci",
    "style",
    "other",
]

TYPE_LABELS = {
    "feat": "Features",
    "fix": "Fixes",
    "refactor": "Refactors",
    "perf": "Performance",
    "docs": "Docs",
    "test": "Tests",
    "chore": "Chores",
    "build": "Build",
    "ci": "CI",
    "style": "Style",
    "other": "Other",
}


def paint(color, text):
    return f"{color}{text}{RESET}"


def parse_bool(value, default):
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    raw = str(value).strip().lower()
    if raw in ("1", "true", "yes", "on"):
        return True
    if raw in ("0", "false", "no", "off"):
        return False
    return default


def normalize_repos(value):
    if value is None:
        return []
    if isinstance(value, str):
        return [v.strip() for v in value.split(",") if v.strip()]
    if isinstance(value, list):
        return [str(v).strip() for v in value if str(v).strip()]
    return []


def load_config():
    paths = [
        os.path.join(os.getcwd(), ".standuprc"),
        os.path.join(os.path.expanduser("~"), ".standuprc"),
    ]
    for path in paths:
        if not os.path.isfile(path):
            continue
        try:
            with open(path, "r", encoding="utf-8") as handle:
                raw = handle.read().strip()
            if not raw:
                return {}
            if raw.lstrip().startswith("{"):
                data = json.loads(raw)
            else:
                data = {}
                for line in raw.splitlines():
                    line = line.strip()
                    if not line or line.startswith("#") or "=" not in line:
                        continue
                    key, value = line.split("=", 1)
                    data[key.strip()] = value.strip()
            config = {}
            config["format"] = data.get("format")
            config["team"] = data.get("team")
            config["copy"] = parse_bool(data.get("copy"), True)
            if "no_copy" in data:
                config["copy"] = not parse_bool(data.get("no_copy"), False)
            config["repos"] = normalize_repos(data.get("repos"))
            return config
        except Exception:
            return {}
    return {}


def parse_commit_subject(subject):
    subject = subject.strip()
    match = re.match(
        r"^(?P<type>[a-zA-Z]+)(\((?P<scope>[^)]+)\))?(?P<breaking>!)?:\s*(?P<msg>.+)$",
        subject,
    )
    if match:
        ctype = match.group("type").lower()
        scope = match.group("scope")
        msg = match.group("msg").strip()
    else:
        ctype = "other"
        scope = None
        msg = subject
    msg = msg.rstrip(".")
    if msg:
        msg = msg[0].upper() + msg[1:]
    if scope:
        msg = f"{scope}: {msg}"
    return {"type": ctype, "message": msg}


def parse_git_log_with_numstat(raw):
    commits = []
    current = None
    for line in raw.splitlines():
        if line.startswith("__COMMIT__\x1f"):
            if current is not None:
                commits.append(current)
            subject = line.split("\x1f", 1)[1].strip()
            parsed = parse_commit_subject(subject)
            current = {
                "type": parsed["type"],
                "message": parsed["message"],
                "files_changed": 0,
            }
            continue

        if not line.strip():
            continue

        if current is None:
            continue

        parts = line.split("\t")
        if len(parts) >= 3:
            current["files_changed"] += 1

    if current is not None:
        commits.append(current)

    return commits


def get_repo_summary(repo_path):
    abs_path = os.path.abspath(repo_path)
    repo_name = os.path.basename(abs_path.rstrip("\\/")) or abs_path
    try:
        result = subprocess.run(
            [
                "git",
                "-C",
                abs_path,
                "log",
                "--since=24 hours ago",
                "--no-merges",
                "--pretty=format:__COMMIT__%x1f%s",
                "--numstat",
            ],
            capture_output=True,
            text=True,
        )
        if result.returncode != 0:
            return None
        commits = parse_git_log_with_numstat(result.stdout.strip())
        return {
            "name": repo_name,
            "path": abs_path,
            "commits": commits,
            "commit_count": len(commits),
            "files_changed": sum(c["files_changed"] for c in commits),
        }
    except FileNotFoundError:
        return None


def summarize_commits(commits):
    if not commits:
        return ["No commits in the last 24 hours"]

    seen = set()
    grouped = {k: [] for k in TYPE_ORDER}

    for commit in commits:
        message = commit["message"]
        key = message.lower()
        if key in seen:
            continue
        seen.add(key)
        ctype = commit["type"] if commit["type"] in grouped else "other"
        grouped[ctype].append(message)

    lines = []
    for ctype in TYPE_ORDER:
        items = grouped[ctype]
        if not items:
            continue
        lines.append(f"{TYPE_LABELS.get(ctype, 'Other')}:")
        for item in items:
            lines.append(f"- {item}")
    return lines


def format_output(repo_summaries, today, blockers, fmt, team=None):
    repo_lines = []
    if not repo_summaries:
        repo_lines.append("No repositories scanned")
    for repo in repo_summaries:
        repo_lines.append(
            f"{repo['name']} ({repo['commit_count']} commits, {repo['files_changed']} files changed):"
        )
        repo_lines.extend(summarize_commits(repo["commits"]))
        repo_lines.append("")
    if repo_lines and repo_lines[-1] == "":
        repo_lines.pop()

    if fmt == "slack":
        lines = []
        if team:
            lines.append(f"*Team:* {team}")
        lines.append("*Yesterday:*")
        for line in repo_lines:
            if not line:
                lines.append("")
            elif line.endswith(":"):
                lines.append(f"*{line}*")
            else:
                lines.append(f"- {line[2:]}" if line.startswith("- ") else f"- {line}")
        lines.append(f"*Today:* {today}")
        lines.append(f"*Blockers:* {blockers or 'None'}")
        return "\n".join(lines)

    if fmt == "markdown":
        lines = ["### Daily Standup", ""]
        if team:
            lines.extend(["**Team:**", team, ""])
        lines.append("**Yesterday:**")
        for line in repo_lines:
            lines.append(line)
        lines.extend(["", "**Today:**", today, "", "**Blockers:**", blockers or "None"])
        return "\n".join(lines)

    lines = []
    if team:
        lines.append(f"Team: {team}")
    lines.append("Yesterday:")
    lines.extend(repo_lines)
    lines.append(f"Today: {today}")
    lines.append(f"Blockers: {blockers or 'None'}")
    return "\n".join(lines)


def copy_to_clipboard(text):
    if not text:
        return False
    try:
        if sys.platform.startswith("win"):
            subprocess.run(["clip"], input=text, text=True, check=True)
            return True
        if sys.platform == "darwin" and shutil.which("pbcopy"):
            subprocess.run(["pbcopy"], input=text, text=True, check=True)
            return True
        if shutil.which("xclip"):
            subprocess.run(
                ["xclip", "-selection", "clipboard"],
                input=text,
                text=True,
                check=True,
            )
            return True
        if shutil.which("xsel"):
            subprocess.run(
                ["xsel", "--clipboard", "--input"], input=text, text=True, check=True
            )
            return True
    except Exception:
        return False
    return False


def collect_repo_paths(config, cli_repos):
    source = cli_repos if cli_repos else config.get("repos") or [os.getcwd()]
    seen = set()
    ordered = []
    for repo in source:
        abs_path = os.path.abspath(repo)
        key = abs_path.lower()
        if key in seen:
            continue
        seen.add(key)
        ordered.append(abs_path)
    return ordered


def main():
    config = load_config()

    parser = argparse.ArgumentParser(
        prog="standup", description="Generate your daily standup from git commits"
    )
    parser.add_argument(
        "--format",
        "-f",
        choices=["plain", "slack", "markdown"],
        default=None,
        help="Output format (default: plain)",
    )
    parser.add_argument("--team", "-t", default=None, help="Team name for standup header")
    parser.add_argument(
        "--repo",
        action="append",
        default=[],
        help="Repository path to scan (repeatable). Defaults to cwd or .standuprc repos.",
    )
    parser.add_argument("--no-copy", action="store_true", help="Disable clipboard auto-copy")
    args = parser.parse_args()

    fmt = args.format or config.get("format") or "plain"
    team = args.team or config.get("team")
    copy_enabled = (not args.no_copy) and config.get("copy", True)
    repo_paths = collect_repo_paths(config, args.repo)

    print()
    print(paint(BOLD + CYAN, "  standup-cli"))
    print(paint(GRAY, "  Generate your daily standup in seconds\n"))

    print(paint(DIM, "  Scanning git commits from last 24hrs..."))
    repo_summaries = []
    skipped = []
    for repo_path in repo_paths:
        summary = get_repo_summary(repo_path)
        if summary is None:
            skipped.append(repo_path)
            continue
        repo_summaries.append(summary)
        print(
            paint(
                GREEN,
                f"  {summary['name']}: {summary['commit_count']} commit(s), "
                f"{summary['files_changed']} file(s) changed",
            )
        )

    if skipped:
        for repo_path in skipped:
            print(paint(YELLOW, f"  Warning: skipped non-git repo {repo_path}"))
    print()

    today = input(paint(BOLD, '  What are you working on today?\n  ') + "> ").strip()
    print()
    blockers = input(paint(BOLD, '  Any blockers? (press Enter for "None")\n  ') + "> ").strip()
    print()

    output = format_output(
        repo_summaries,
        today or "(not specified)",
        blockers,
        fmt,
        team=team,
    )

    divider = paint(GRAY, "  " + "-" * 50)
    fmt_label = paint(MAGENTA, f"[{fmt}]")

    print(divider)
    print(paint(BOLD + GREEN, f"  Your Standup {fmt_label}\n"))
    for line in output.split("\n"):
        print("  " + line)
    print()
    print(divider)
    print()
    print(paint(GRAY, "  Tip: use --format slack | markdown | plain"))
    print()

    if copy_enabled:
        if copy_to_clipboard(output):
            print(paint(GREEN, "  Copied standup to clipboard"))
        else:
            print(paint(YELLOW, "  Warning: clipboard copy unavailable"))
        print()


if __name__ == "__main__":
    main()
