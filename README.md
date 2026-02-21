# ⚡ standup-cli

> Generate your daily standup from git commits — right in your terminal.

Never manually write a standup again. `standup-cli` scans your git commits from the last 24 hours, asks what you're working on today and if you have blockers, then formats a clean standup message ready to paste anywhere.

```
$ standup

  ⚡ standup-cli
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

**via npm:**
```bash
npm install -g standup-cli
```

**via pip:**
```bash
pip install standup-cli
```

## Usage

```bash
# Default (plain text output)
standup

# Slack-ready output
standup --format slack

# Markdown output
standup --format markdown
```

## Output Formats

**Plain** (default) — paste anywhere:
```
Yesterday: Fixed auth bug, updated docs
Today: Stripe integration
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

- [ ] Copy to clipboard automatically
- [ ] Support multiple repos
- [ ] `.standuprc` config file for team name, format preference
- [ ] Weekly summary mode

## License

MIT © [Muhammad Talha Khan](https://github.com/muhtalhakhan)