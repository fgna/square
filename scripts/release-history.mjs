#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const run = (...args) => execFileSync('git', args, {encoding: 'utf8'}).trim();
const [mode = 'generate', base = 'v1.0.0', head = 'HEAD', output] = process.argv.slice(2);
const valid = new Set(['new', 'improved', 'fixed', 'removed']);
const read = (name) => {
  const item = JSON.parse(readFileSync(name, 'utf8'));
  if (!item.title?.trim() || !valid.has(item.category) || !item.description?.trim() || !Number.isInteger(item.pr) || item.pr < 1) {
    throw new Error(`Invalid release entry: ${name}`);
  }
  return item;
};
if (mode === 'check-pr') {
  const diff = run('diff', '--name-only', `${base}...HEAD`).split('\n').filter(Boolean);
  const added = run('diff', '--name-only', '--diff-filter=A', `${base}...HEAD`).split('\n').filter(Boolean);
  const relevant = diff.some(f => /^(apps|packages)\//.test(f));
  if (relevant && !added.some(f => /^changes\/[^/]+\.json$/.test(f)) && !added.some(f => /^changes\/no-user-facing-[^/]+\.md$/.test(f))) {
    throw new Error('User-facing code PR needs a changes/*.json entry or changes/no-user-facing-<unique-id>.md explaining why none applies.');
  }
  for (const file of added.filter(f => /^changes\/[^/]+\.json$/.test(f))) if (existsSync(file)) read(file);
  console.log('Release entry PR check passed');
} else if (mode === 'generate') {
  const changed = run('diff', '--name-only', '--diff-filter=A', `${base}..${head}`).split('\n').filter(f => /^changes\/[^/]+\.json$/.test(f)).sort();
  const groups = { new: [], improved: [], fixed: [], removed: [] };
  for (const file of changed) {
    const item = JSON.parse(run('show', `${head}:${file}`));
    if (!item.title?.trim() || !valid.has(item.category) || !item.description?.trim() || !Number.isInteger(item.pr) || item.pr < 1) throw new Error(`Invalid entry ${file}`);
    groups[item.category].push(`- **${item.title}** ([#${item.pr}](https://github.com/fgna/square/pull/${item.pr})): ${item.description}`);
  }
  const sections = Object.entries(groups).filter(([, rows]) => rows.length).map(([name, rows]) => `## ${name[0].toUpperCase() + name.slice(1)}\n\n${rows.join('\n')}`);
  const markdown = `# Square release history: ${base}.. ${head}\n\n${sections.join('\n\n') || 'No user-facing changes recorded.'}\n`;
  if (output) writeFileSync(output, markdown); else process.stdout.write(markdown);
} else throw new Error('Usage: node scripts/release-history.mjs [check-pr|generate] [base-ref] [head-ref] [output-file]');
