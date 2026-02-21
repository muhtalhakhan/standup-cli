#!/usr/bin/env python3

import subprocess
import sys
import argparse

# ANSI colors
RESET  = "\x1b[0m"
BOLD   = "\x1b[1m"
DIM    = "\x1b[2m"
CYAN   = "\x1b[36m"
GREEN  = "\x1b[32m"
YELLOW = "\x1b[33m"
MAGENTA= "\x1b[35m"
GRAY   = "\x1b[90m"

def paint(color, text):
    return f"{color}{text}{RESET}"

def get_git_commits():
    try:
        result = subprocess.run(
            ["git", "log", '--since=24 hours ago', '--pretty=format:%s', '--no-merges'],
            capture_output=True, text=True
        )
        if result.returncode != 0:
            return None
        lines = [l.strip() for l in result.stdout.strip().split('\n') if l.strip()]
        return lines
    except FileNotFoundError:
        return None

def format_output(commits, today, blockers, fmt):
    yesterday = ', '.join(
        c[0].upper() + c[1:] for c in commits
    ) if commits else 'No commits in the last 24 hours'

    if fmt == 'slack':
        return '\n'.join([
            f"*📋 Yesterday:* {yesterday}",
            f"*🚀 Today:* {today}",
            f"*🚧 Blockers:* {blockers or 'None'}",
        ])
    elif fmt == 'markdown':
        return '\n'.join([
            "### Daily Standup",
            "",
            "**Yesterday:**",
            yesterday,
            "",
            "**Today:**",
            today,
            "",
            "**Blockers:**",
            blockers or 'None',
        ])
    else:  # plain
        return '\n'.join([
            f"Yesterday: {yesterday}",
            f"Today: {today}",
            f"Blockers: {blockers or 'None'}",
        ])

def main():
    parser = argparse.ArgumentParser(
        prog='standup',
        description='⚡ Generate your daily standup from git commits'
    )
    parser.add_argument(
        '--format', '-f',
        choices=['plain', 'slack', 'markdown'],
        default='plain',
        help='Output format (default: plain)'
    )
    args = parser.parse_args()
    fmt = args.format

    print()
    print(paint(BOLD + CYAN, '  ⚡ standup-cli'))
    print(paint(GRAY, '  Generate your daily standup in seconds\n'))

    print(paint(DIM, '  🔍 Scanning git commits from last 24hrs...'))
    commits = get_git_commits()

    if commits is None:
        print(paint(YELLOW, '  ⚠️  Not a git repo — skipping commit scan.\n'))
        commits = []
    elif len(commits) == 0:
        print(paint(YELLOW, '  ⚠️  No commits found in the last 24hrs.\n'))
    else:
        print(paint(GREEN, f'  ✅ Found {len(commits)} commit(s):\n'))
        for msg in commits:
            print(paint(GRAY, f'     • {msg}'))
        print()

    today = input(paint(BOLD, '  🚀 What are you working on today?\n  ') + '> ').strip()
    print()
    blockers = input(paint(BOLD, '  🚧 Any blockers? (press Enter for "None")\n  ') + '> ').strip()
    print()

    output = format_output(commits, today or '(not specified)', blockers, fmt)

    divider = paint(GRAY, '  ' + '─' * 50)
    fmt_label = paint(MAGENTA, f'[{fmt}]')

    print(divider)
    print(paint(BOLD + GREEN, f'  ✅ Your Standup {fmt_label}\n'))
    for line in output.split('\n'):
        print('  ' + line)
    print()
    print(divider)
    print()
    print(paint(GRAY, '  💡 Tip: use --format slack | markdown | plain'))
    print()

if __name__ == '__main__':
    main()