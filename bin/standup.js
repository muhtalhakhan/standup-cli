#!/usr/bin/env node

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const readline = require('readline');
const { execFileSync, spawnSync } = require('child_process');

const TYPE_ORDER = [
  'feat',
  'fix',
  'refactor',
  'perf',
  'docs',
  'test',
  'chore',
  'build',
  'ci',
  'style',
  'other',
];

const TYPE_LABELS = {
  feat: 'Features',
  fix: 'Fixes',
  refactor: 'Refactors',
  perf: 'Performance',
  docs: 'Docs',
  test: 'Tests',
  chore: 'Chores',
  build: 'Build',
  ci: 'CI',
  style: 'Style',
  other: 'Other',
};

const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  magenta: '\x1b[35m',
  gray: '\x1b[90m',
};

function paint(color, text) {
  return `${color}${text}${c.reset}`;
}

function parseBool(value, defaultValue) {
  if (value === undefined || value === null) return defaultValue;
  if (typeof value === 'boolean') return value;
  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return defaultValue;
}

function normalizeRepos(value) {
  if (value === undefined || value === null) return [];
  if (typeof value === 'string') {
    return value.split(',').map((v) => v.trim()).filter(Boolean);
  }
  if (Array.isArray(value)) {
    return value.map((v) => String(v).trim()).filter(Boolean);
  }
  return [];
}

function loadConfig() {
  const candidates = [
    path.join(process.cwd(), '.standuprc'),
    path.join(os.homedir(), '.standuprc'),
  ];

  for (const configPath of candidates) {
    if (!fs.existsSync(configPath) || !fs.statSync(configPath).isFile()) continue;
    try {
      const raw = fs.readFileSync(configPath, 'utf8').trim();
      if (!raw) return {};

      let data;
      if (raw.startsWith('{')) {
        data = JSON.parse(raw);
      } else {
        data = {};
        for (const line of raw.split(/\r?\n/)) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
          const idx = trimmed.indexOf('=');
          const key = trimmed.slice(0, idx).trim();
          const val = trimmed.slice(idx + 1).trim();
          data[key] = val;
        }
      }

      const config = {
        format: data.format,
        team: data.team,
        copy: parseBool(data.copy, true),
        repos: normalizeRepos(data.repos),
      };
      if (Object.prototype.hasOwnProperty.call(data, 'no_copy')) {
        config.copy = !parseBool(data.no_copy, false);
      }
      return config;
    } catch {
      return {};
    }
  }
  return {};
}

function parseCommitSubject(subject) {
  const trimmed = subject.trim();
  const match = trimmed.match(/^([a-zA-Z]+)(\(([^)]+)\))?(!)?:\s*(.+)$/);
  if (!match) {
    return { type: 'other', message: capitalize(trimmed.replace(/\.$/, '')) };
  }

  const commitType = match[1].toLowerCase();
  const scope = match[3];
  let message = match[5].trim().replace(/\.$/, '');
  message = capitalize(message);
  if (scope) message = `${scope}: ${message}`;
  return { type: commitType, message };
}

function capitalize(text) {
  if (!text) return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function parseGitLogWithNumstat(raw) {
  const commits = [];
  let current = null;
  for (const line of raw.split(/\r?\n/)) {
    if (line.startsWith('__COMMIT__\x1f')) {
      if (current) commits.push(current);
      const subject = line.split('\x1f', 2)[1].trim();
      const parsed = parseCommitSubject(subject);
      current = {
        type: parsed.type,
        message: parsed.message,
        files_changed: 0,
      };
      continue;
    }

    if (!line.trim() || !current) continue;
    const parts = line.split('\t');
    if (parts.length >= 3) current.files_changed += 1;
  }
  if (current) commits.push(current);
  return commits;
}

function getRepoSummary(repoPath) {
  const absPath = path.resolve(repoPath);
  const repoName = path.basename(absPath) || absPath;
  try {
    const raw = execFileSync(
      'git',
      [
        '-C',
        absPath,
        'log',
        '--since=24 hours ago',
        '--no-merges',
        '--pretty=format:__COMMIT__%x1f%s',
        '--numstat',
      ],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
    ).trim();

    const commits = parseGitLogWithNumstat(raw);
    return {
      name: repoName,
      path: absPath,
      commits,
      commit_count: commits.length,
      files_changed: commits.reduce((sum, cmt) => sum + cmt.files_changed, 0),
    };
  } catch {
    return null;
  }
}

function summarizeCommits(commits) {
  if (!commits || commits.length === 0) {
    return ['No commits in the last 24 hours'];
  }

  const seen = new Set();
  const grouped = {};
  for (const t of TYPE_ORDER) grouped[t] = [];

  for (const commit of commits) {
    const key = commit.message.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const t = grouped[commit.type] ? commit.type : 'other';
    grouped[t].push(commit.message);
  }

  const lines = [];
  for (const t of TYPE_ORDER) {
    if (grouped[t].length === 0) continue;
    lines.push(`${TYPE_LABELS[t] || 'Other'}:`);
    for (const item of grouped[t]) lines.push(`- ${item}`);
  }
  return lines;
}

function formatOutput({ repoSummaries, today, blockers, format, team }) {
  const repoLines = [];
  if (!repoSummaries || repoSummaries.length === 0) {
    repoLines.push('No repositories scanned');
  }

  for (const repo of repoSummaries) {
    repoLines.push(
      `${repo.name} (${repo.commit_count} commits, ${repo.files_changed} files changed):`
    );
    repoLines.push(...summarizeCommits(repo.commits));
    repoLines.push('');
  }
  if (repoLines.length > 0 && repoLines[repoLines.length - 1] === '') {
    repoLines.pop();
  }

  if (format === 'slack') {
    const lines = [];
    if (team) lines.push(`*Team:* ${team}`);
    lines.push('*Yesterday:*');
    for (const line of repoLines) {
      if (!line) lines.push('');
      else if (line.endsWith(':')) lines.push(`*${line}*`);
      else if (line.startsWith('- ')) lines.push(`- ${line.slice(2)}`);
      else lines.push(`- ${line}`);
    }
    lines.push(`*Today:* ${today}`);
    lines.push(`*Blockers:* ${blockers || 'None'}`);
    return lines.join('\n');
  }

  if (format === 'markdown') {
    const lines = ['### Daily Standup', ''];
    if (team) lines.push('**Team:**', team, '');
    lines.push('**Yesterday:**');
    lines.push(...repoLines);
    lines.push('', '**Today:**', today, '', '**Blockers:**', blockers || 'None');
    return lines.join('\n');
  }

  const lines = [];
  if (team) lines.push(`Team: ${team}`);
  lines.push('Yesterday:');
  lines.push(...repoLines);
  lines.push(`Today: ${today}`);
  lines.push(`Blockers: ${blockers || 'None'}`);
  return lines.join('\n');
}

function copyToClipboard(text) {
  if (!text) return false;
  try {
    if (process.platform === 'win32') {
      const result = spawnSync('clip', [], { input: text, encoding: 'utf8' });
      return result.status === 0;
    }
    if (process.platform === 'darwin') {
      const result = spawnSync('pbcopy', [], { input: text, encoding: 'utf8' });
      return result.status === 0;
    }

    const xclip = spawnSync('xclip', ['-selection', 'clipboard'], {
      input: text,
      encoding: 'utf8',
    });
    if (xclip.status === 0) return true;

    const xsel = spawnSync('xsel', ['--clipboard', '--input'], {
      input: text,
      encoding: 'utf8',
    });
    return xsel.status === 0;
  } catch {
    return false;
  }
}

function collectRepoPaths(configRepos, cliRepos) {
  const source = cliRepos.length > 0 ? cliRepos : (configRepos.length > 0 ? configRepos : [process.cwd()]);
  const unique = [];
  const seen = new Set();
  for (const repo of source) {
    const abs = path.resolve(repo);
    const key = abs.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(abs);
  }
  return unique;
}

function parseArgs(argv) {
  const parsed = {
    format: null,
    team: null,
    noCopy: false,
    repos: [],
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if ((arg === '--format' || arg === '-f') && argv[i + 1]) {
      parsed.format = String(argv[i + 1]).toLowerCase();
      i += 1;
      continue;
    }
    if ((arg === '--team' || arg === '-t') && argv[i + 1]) {
      parsed.team = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === '--repo' && argv[i + 1]) {
      parsed.repos.push(argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg === '--no-copy') {
      parsed.noCopy = true;
      continue;
    }
    if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }
  }

  return parsed;
}

function printHelp() {
  const help = [
    '',
    'standup-cli',
    '',
    'Usage:',
    '  standup [--format plain|slack|markdown] [--team "Team Name"] [--repo <path>] [--no-copy]',
    '',
    'Options:',
    '  -f, --format   Output format (plain, slack, markdown)',
    '  -t, --team     Team name for standup header',
    '  --repo         Repository path to scan (repeatable)',
    '  --no-copy      Disable clipboard auto-copy',
    '  -h, --help     Show help',
    '',
  ];
  console.log(help.join('\n'));
}

function ask(rl, question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => resolve(answer.trim()));
  });
}

async function main() {
  const config = loadConfig();
  const cli = parseArgs(process.argv.slice(2));

  const validFormats = ['plain', 'slack', 'markdown'];
  const format = cli.format || config.format || 'plain';
  if (!validFormats.includes(format)) {
    console.error(`Unknown format "${format}". Choose: plain, slack, markdown`);
    process.exit(1);
  }

  const team = cli.team || config.team || null;
  const copyEnabled = !cli.noCopy && (config.copy !== undefined ? config.copy : true);
  const repoPaths = collectRepoPaths(config.repos || [], cli.repos);

  console.log('');
  console.log(paint(c.bold + c.cyan, '  standup-cli'));
  console.log(paint(c.gray, '  Generate your daily standup in seconds\n'));

  console.log(paint(c.dim, '  Scanning git commits from last 24hrs...'));
  const repoSummaries = [];
  const skipped = [];
  for (const repoPath of repoPaths) {
    const summary = getRepoSummary(repoPath);
    if (!summary) {
      skipped.push(repoPath);
      continue;
    }
    repoSummaries.push(summary);
    console.log(
      paint(
        c.green,
        `  ${summary.name}: ${summary.commit_count} commit(s), ${summary.files_changed} file(s) changed`
      )
    );
  }
  for (const skippedRepo of skipped) {
    console.log(paint(c.yellow, `  Warning: skipped non-git repo ${skippedRepo}`));
  }
  console.log('');

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const today = await ask(rl, paint(c.bold, '  What are you working on today?\n  ') + '> ');
  console.log('');
  const blockers = await ask(rl, paint(c.bold, '  Any blockers? (press Enter for "None")\n  ') + '> ');
  console.log('');
  rl.close();

  const output = formatOutput({
    repoSummaries,
    today: today || '(not specified)',
    blockers: blockers || 'None',
    format,
    team,
  });

  const divider = paint(c.gray, '  ' + '-'.repeat(50));
  const formatLabel = paint(c.magenta, `[${format}]`);

  console.log(divider);
  console.log(paint(c.bold + c.green, `  Your Standup ${formatLabel}\n`));
  output.split('\n').forEach((line) => console.log('  ' + line));
  console.log('');
  console.log(divider);
  console.log('');
  console.log(paint(c.gray, '  Tip: use --format slack | markdown | plain'));
  console.log('');

  if (copyEnabled) {
    if (copyToClipboard(output)) console.log(paint(c.green, '  Copied standup to clipboard'));
    else console.log(paint(c.yellow, '  Warning: clipboard copy unavailable'));
    console.log('');
  }
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
