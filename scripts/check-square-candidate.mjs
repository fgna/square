#!/usr/bin/env node
// Read-only compatibility preflight for an operator-selected Square candidate.
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { compareVersions, parseVersion, versionFromStagingPair } from './check-square-update.mjs';

export async function checkCandidate(current, pairPath, dependencies = {}) {
  if (!parseVersion(current)) throw new Error('Invalid installed stable Square version');
  const validate = dependencies.validate ?? ((file) =>
    execFileSync(process.execPath, [resolve('scripts/validate-staging-pair.mjs'), file], {
      stdio: 'pipe', encoding: 'utf8', timeout: 60000,
    }));
  const resolveVersion = dependencies.resolveVersion ?? versionFromStagingPair;
  // Fail closed on invalid or mismatched core/content pins before comparing versions.
  const result = validate(pairPath);
  const candidate = await resolveVersion(pairPath);
  if (compareVersions(candidate, current) <= 0) {
    throw new Error('Candidate must be a newer stable Square release');
  }
  return { current, candidate, validation: result };
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length !== 4 || args[0] !== '--current' || args[2] !== '--candidate-pair' ||
      !parseVersion(args[1])) {
    console.error('Usage: node scripts/check-square-candidate.mjs --current 1.0.0 --candidate-pair /absolute/path/to/pair.json');
    process.exitCode = 2;
    return;
  }
  try {
    const pairPath = args[3];
    if (!pairPath.startsWith('/')) throw new Error('Candidate pair path must be absolute');
    const result = await checkCandidate(args[1], pairPath);
    console.log(result.validation.trim());
    console.log(`PASS: Candidate Square ${result.candidate} is newer than installed ${result.current}; pinned Core and instance content validated.`);
    console.log('Staging/browser checks, migrations, backups and operator approval remain mandatory. No update was installed.');
  } catch (error) {
    console.error(`FAIL: Candidate preflight rejected: ${error.message}`);
    process.exitCode = 1;
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
