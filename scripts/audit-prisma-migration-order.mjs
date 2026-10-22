#!/usr/bin/env node
/**
 * Read-only historical Prisma SQL inventory for migration issue #16.
 * It does not connect to any database and never modifies existing migrations.
 * This specifically detects ordering around the known Post.type backfill;
 * it is not a substitute for a real migrate deploy rehearsal.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = resolve(dirname(fileURLToPath(import.meta.url)), '../apps/api/prisma/migrations');
const migrations = readdirSync(dir, { withFileTypes: true })
  .filter(item => item.isDirectory())
  .map(item => item.name).sort();
const events = [];
let firstPostTypeDefinition = null;
let firstPostTypeUse = null;
for (const migration of migrations) {
  const file = join(dir, migration, 'migration.sql');
  let sql;
  try { sql = readFileSync(file, 'utf8'); } catch { continue; }
  // Anchor definitions to SQL statements targeting Post, not any table
  // with a column called "type" (e.g. Reaction or Notification).
  for (const statementMatch of sql.matchAll(/[^;]+;/g)) {
    const statement = statementMatch[0];
    const line = 1 + sql.slice(0, statementMatch.index).split(/\r?\n/).length - 1;
    const createPost = /CREATE\s+TABLE\s+(?:"public"\.)?"Post"\s*\(/i.test(statement);
    const alterPost = /ALTER\s+TABLE\s+(?:ONLY\s+)?(?:"public"\.)?"Post"\s+ADD\s+COLUMN\s+"type"(?:\s|;|$)/i.test(statement);
    const declared = (createPost && /^\s*"type"\s+/m.test(statement)) || alterPost;
    if (declared) {
      const event = { kind: 'post_type_definition', migration, line, statement: statement.trim().slice(0, 240) };
      events.push(event);
      firstPostTypeDefinition ??= event;
    }
    const uses = /(?:FROM|JOIN)\s+(?:"public"\.)?"Post"(?![A-Za-z0-9_])[\s\S]*?"type"\s*=\s*'INTRODUCTION'/i.test(statement);
    if (uses) {
      const event = { kind: 'introduction_backfill', migration, line, statement: statement.trim().slice(0, 240) };
      events.push(event);
      firstPostTypeUse ??= event;
    }
  }
}
// This repository has a known INTRODUCTION backfill. A missing match is a
// scanner failure, never evidence that the migration sequence is safe.
if (!firstPostTypeUse) {
  console.error('Audit incomplete: known Post.type INTRODUCTION backfill was not detected');
  process.exitCode = 2;
}
const inconsistent = !!firstPostTypeUse && (!firstPostTypeDefinition ||
  firstPostTypeUse.migration < firstPostTypeDefinition.migration);
const report = {
  migrationCount: migrations.length,
  earliestDefinition: firstPostTypeDefinition,
  earliestBackfill: firstPostTypeUse,
  backfillBeforeDefinition: inconsistent,
  events,
  limitations: [
    'Source-only heuristic; cannot prove PostgreSQL execution semantics.',
    'Statements that use dynamic SQL, unquoted identifiers or unusual DDL may be missed.',
    'Use a disposable isolated PostgreSQL with prisma migrate deploy for actual acceptance.',
  ],
};
console.log(JSON.stringify(report, null, 2));
if (process.argv.includes('--strict') && inconsistent) process.exitCode = 1;
