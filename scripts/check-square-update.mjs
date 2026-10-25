#!/usr/bin/env node
// Read-only operator check. Never changes an instance, checkout, or database.
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

export function parseVersion(input) {
  const match = /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(input);
  return match ? match.slice(1).map(Number) : null;
}

export function compareVersions(a, b) {
  const left = parseVersion(a);
  const right = parseVersion(b);
  if (!left || !right) throw new Error('Expected stable semantic versions (for example 1.0.0)');
  for (let i = 0; i < 3; i++) {
    if (left[i] !== right[i]) return left[i] > right[i] ? 1 : -1;
  }
  return 0;
}

export function findUpdates(current, releases) {
  if (!parseVersion(current)) throw new Error('Invalid installed Square version');
  if (!Array.isArray(releases)) throw new Error('Invalid release list');
  return releases
    .filter((release) => release && !release.draft && !release.prerelease &&
      typeof release.tag_name === 'string' && parseVersion(release.tag_name) &&
      compareVersions(release.tag_name, current) > 0)
    .sort((a, b) => compareVersions(a.tag_name, b.tag_name));
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 2 || args[0] !== '--current' ||
      !parseVersion(args[1]) ||
      (args.length !== 2 && !(args.length === 4 && args[2] === '--releases-file'))) {
    console.error('Usage: node scripts/check-square-update.mjs --current 1.0.0 [--releases-file releases.json]');
    process.exitCode = 2;
    return;
  }
  const current = args[1];
  let releases;
  if (args.length === 4) {
    releases = JSON.parse(await readFile(args[3], 'utf8'));
  } else {
    const response = await fetch('https://api.github.com/repos/fgna/square/releases?per_page=100', {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'square-update-check' },
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error(`GitHub releases request failed: HTTP ${response.status}`);
    releases = await response.json();
  }
  const updates = findUpdates(current, releases);
  console.log(`Installed Square version: ${current}`);
  if (!updates.length) {
    console.log('No newer stable release found among the inspected releases.');
    return;
  }
  for (const release of updates) {
    const version = release.tag_name;
    const url = `https://github.com/fgna/square/releases/tag/${encodeURIComponent(version)}`;
    console.log(`- ${version}: ${url}`);
  }
  console.log('Review release notes and run the pinned-revision staging-pair validator before any deployment.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`Update check failed: ${error.message}`);
    process.exitCode = 1;
  });
}
