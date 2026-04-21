# v0.3 Prep Log

Date: 2026-02-22

## Completed today (v0.2.x line)

- Implemented Conventional Commit parsing in Python and Node CLIs.
- Added files-changed counting from git `--numstat`.
- Added grouped output by repository.
- Added `.standuprc` config support (project/home, JSON and key-value).
- Added clipboard auto-copy with `--no-copy` override.
- Added `--repo` repeatable flag to scan multiple repos.
- Updated output/formatting and docs for shipped behavior.
- Bumped versions to `0.2.0` in:
  - `pyproject.toml`
  - `package.json`

## Additional fix added today

- Improved Git error handling for safe-directory failures:
  - Detects `detected dubious ownership in repository`.
  - Shows actionable command to fix:
    - `git config --global --add safe.directory "<repo_path>"`
  - Avoids silently reporting only "non-git repo" for this case.

Files touched for this fix:
- `standup_cli/main.py`
- `bin/standup.js`

## Candidate scope for v0.3

- Weekly summary mode.
- Better multi-repo UX:
  - repo name aliases
  - skip/include patterns
  - clearer per-repo error summary
- Optional non-interactive mode (flags for today/blockers).
- Optional output templating.
- Improved tests for parsing and error-handling edge cases.

## Notes

- In sandbox/shared/admin-owned environments, Git may require `safe.directory`.
- Current behavior now provides explicit remediation guidance to users.
