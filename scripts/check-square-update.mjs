#!/usr/bin/env node
// Read-only operator check. Never changes an instance, checkout, or database.
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

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

export async function versionFromStagingPair(file, runGit = (args) => execFileSync('git', args, { encoding: 'utf8' }).trim()) {
  const pair = JSON.parse(await readFile(file, 'utf8'));
  if (!pair || typeof pair.core?.checkout !== 'string' || typeof pair.core?.revision !== 'string' ||
      !/^[a-f0-9]{40}$/i.test(pair.core.revision)) {
    throw new Error('Invalid staging pair: expected core.checkout and 40-character core.revision');
  }
  const checkout = resolve(pair.core.checkout);
  // The expected SHA must be the deployed revision. Reject stale or mismatched checkouts.
  const head = runGit(['-C', checkout, 'rev-parse', 'HEAD']);
  if (head.toLowerCase() !== pair.core.revision.toLowerCase()) {
    throw new Error('Staging pair Core revision does not match checkout HEAD');
  }
  const tags = runGit(['-C', checkout, 'tag', '--points-at', 'HEAD']).split(/\\r?\\n/).filter(Boolean);
  const versions = [...new Set(tags.filter(parseVersion))];
  if (versions.length !== 1) {
    throw new Error('Pinned Core revision must have exactly one stable Square release tag');
  }
  return versions[0];
}

async function main() {
  const args = process.argv.slice(2);
  const fromPair = args[0] === '--staging-pair';
  const valid = (fromPair || args[0] === '--current') && args.length >= 2 &&
    (args.length === 2 || (args.length === 4 && args[2] === '--releases-file'));
  if (!valid || (!fromPair && !parseVersion(args[1]))) {
    console.error('Usage: node scripts/check-square-update.mjs (--current 1.0.0 | --staging-pair pair.json) [--releases-file releases.json]');
    process.exitCode = 2;
    return;
  }
  const current = fromPair ? await versionFromStagingPair(args[1]) : args[1];
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
