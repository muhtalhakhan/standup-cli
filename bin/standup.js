#!/usr/bin/env node

'use strict';

const { execSync } = require('child_process');
const readline = require('readline');
const args = process.argv.slice(2);

// Parse --format flag
let format = 'plain';
const fmtIndex = args.indexOf('--format');
if (fmtIndex !== -1 && args[fmtIndex + 1]) {
  format = args[fmtIndex + 1].toLowerCase();
}
const validFormats = ['plain', 'slack', 'markdown'];
if (!validFormats.includes(format)) {
  console.error(`❌  Unknown format "${format}". Choose: plain, slack, markdown`);
  process.exit(1);
}

// Colors
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

function getGitCommits() {
  try {
    const raw = execSync(
      'git log --since="24 hours ago" --pretty=format:"%s" --no-merges',
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
    ).trim();
    if (!raw) return [];
    return raw.split('\n').filter(Boolean);
  } catch {
    return null; // not a git repo
  }
}

function ask(rl, question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => resolve(answer.trim()));
  });
}

function formatOutput({ commits, today, blockers, format }) {
  const yesterday = commits && commits.length > 0
    ? commits.map(c => c.charAt(0).toUpperCase() + c.slice(1)).join(', ')
    : 'No commits in the last 24 hours';

  if (format === 'slack') {
    return [
      '*📋 Yesterday:* ' + yesterday,
      '*🚀 Today:* ' + today,
      '*🚧 Blockers:* ' + (blockers || 'None'),
    ].join('\n');
  }

  if (format === 'markdown') {
    return [
      '### Daily Standup',
      '',
      '**Yesterday:**',
      yesterday,
      '',
      '**Today:**',
      today,
      '',
      '**Blockers:**',
      blockers || 'None',
    ].join('\n');
  }

  // plain
  return [
    'Yesterday: ' + yesterday,
    'Today: ' + today,
    'Blockers: ' + (blockers || 'None'),
  ].join('\n');
}

async function main() {
  console.log('');
  console.log(paint(c.bold + c.cyan, '  ⚡ standup-cli'));
  console.log(paint(c.gray, '  Generate your daily standup in seconds\n'));

  // Git commits
  console.log(paint(c.dim, '  🔍 Scanning git commits from last 24hrs...'));
  const commits = getGitCommits();

  if (commits === null) {
    console.log(paint(c.yellow, '  ⚠️  Not a git repo — skipping commit scan.\n'));
  } else if (commits.length === 0) {
    console.log(paint(c.yellow, '  ⚠️  No commits found in the last 24hrs.\n'));
  } else {
    console.log(paint(c.green, `  ✅ Found ${commits.length} commit(s):\n`));
    commits.forEach(msg => {
      console.log(paint(c.gray, `     • ${msg}`));
    });
    console.log('');
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  const today = await ask(rl, paint(c.bold, '  🚀 What are you working on today?\n  ') + '> ');
  console.log('');
  const blockers = await ask(rl, paint(c.bold, '  🚧 Any blockers? (press Enter for "None")\n  ') + '> ');
  console.log('');
  rl.close();

  const output = formatOutput({
    commits: commits || [],
    today: today || '(not specified)',
    blockers: blockers || 'None',
    format,
  });

  const divider = paint(c.gray, '  ' + '─'.repeat(50));
  const formatLabel = paint(c.magenta, `[${format}]`);

  console.log(divider);
  console.log(paint(c.bold + c.green, `  ✅ Your Standup ${formatLabel}\n`));
  output.split('\n').forEach(line => console.log('  ' + line));
  console.log('');
  console.log(divider);
  console.log('');
  console.log(paint(c.gray, '  💡 Tip: use --format slack | markdown | plain'));
  console.log('');
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});