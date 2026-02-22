#⚡ standup-cli

> Generate your daily standup from git commits — right in your terminal.

Never manually write a standup again. `standup-cli` scans your git commits from the last 24 hours, asks what you're working on today and if you have blockers, then formats a clean standup message ready to paste anywhere.

```bash
$ standup

  ⚡ standup-cli-tool
  Generate your daily standup in seconds

  🔍 Scanning git commits from last 24hrs...
  ✅ Found 3 commit(s):

     • Fixed auth bug in login flow
     • Updated API documentation
     • Refactor user model

  🚀 What are you working on today?
  > Integrating Stripe payment API

  🚧 Any blockers? (press Enter for "None")
  > None

  ──────────────────────────────────────────────────
  ✅ Your Standup [plain]

  Yesterday: Fixed auth bug in login flow, Updated API documentation, Refactor user model
  Today: Integrating Stripe payment API
  Blockers: None
  ──────────────────────────────────────────────────

  💡 Tip: use --format slack | markdown | plain
```

## Install

**via npm**:

```bash
npm install -g standup-cli-tool
```

**via pip**:

```bash
pip install standup-cli-tool
```

## Usage

```bash
# Default (plain output, current repo, clipboard on)
standup

# Slack-ready output
standup --format slack

# Markdown output
standup --format markdown

# Team label
standup --team "Platform"

# Disable auto-copy
standup --no-copy

# Scan multiple repositories
standup --repo . --repo ../another-repo
```

## What It Includes

- Conventional Commit parsing (`feat`, `fix`, `docs`, etc.) into grouped sections
- Files changed count per repository (last 24h window)
- Output grouped by repository
- Clipboard auto-copy by default
- `.standuprc` support for defaults

## .standuprc

Place `.standuprc` in the current project or your home directory.

JSON format:

```json
{
  "format": "slack",
  "team": "Platform",
  "copy": true,
  "repos": [".", "../service-api"]
}
```

Key-value format is also supported:

```ini
format=plain
team=Platform
copy=true
repos=.,../service-api
```

## Output Example (plain)

```text
Team: Platform
Yesterday:
standup-cli (3 commits, 9 files changed):
Features:
- Add repo grouping support
Fixes:
- Handle empty commit logs

service-api (2 commits, 4 files changed):
Docs:
- Update API usage notes

Today: Finish release checks
Blockers: None
```

**Slack** — with bold formatting:
```
*📋 Yesterday:* Fixed auth bug, updated docs
*🚀 Today:* Stripe integration
*🚧 Blockers:* None
```

**Markdown** — for GitHub, Notion, etc:
```markdown
### Daily Standup

**Yesterday:**
Fixed auth bug, updated docs

**Today:**
Stripe integration

**Blockers:**
None
```

## How it works

1. Runs `git log --since="24 hours ago"` in your current directory
2. Prompts you for today's focus and any blockers
3. Formats and prints your standup

> **Tip:** Run it from your project root for best results. Works with any git repo.

## Roadmap (v1 ideas)

- [x] Copy to clipboard automatically
- [ ] Support multiple repos
- [x] `.standuprc` config file for team name, format preference
- [ ] Weekly summary mode

## License

MIT © [Muhammad Talha Khan](https://github.com/muhtalhakhan)
