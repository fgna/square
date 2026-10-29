#!/usr/bin/env node
// Destructive only inside a newly created disposable container. No target URL input.
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// Reviewed main revision before the Android download migration. Not a published release.
const baseline = 'd493469abf751bd0b7a951cd2428252d22a78351';
const container = `square-upgrade-${randomUUID()}`;
const work = mkdtempSync(join(tmpdir(), 'square-upgrade-recovery-'));
const run = (cmd, args, options = {}) => execFileSync(cmd, args, {
  cwd: root, encoding: 'utf8', timeout: 120000, maxBuffer: 32 * 1024 * 1024, ...options,
});
let created = false;
try {
  if (process.argv.length !== 2) throw new Error('No arguments accepted: this creates its own disposable database');
  const prisma = join(root, 'apps/api/node_modules/.bin/prisma');
  assert.ok(existsSync(prisma), 'Install lockfile-pinned workspace dependencies first');
  run('docker', ['info']);
  const before = join(work, 'before');
  const candidate = join(work, 'candidate');
  mkdirSync(before);
  mkdirSync(candidate);
  const archive = run('git', ['archive', baseline, 'apps/api/prisma'], { encoding: 'buffer' });
  run('tar', ['-x', '-C', before], { input: archive });
  cpSync(join(root, 'apps/api/prisma'), join(candidate, 'prisma'), { recursive: true });
  const oldSchema = join(before, 'apps/api/prisma/schema.prisma');
  const candidateSchema = join(candidate, 'prisma/schema.prisma');
  // This fixture must continue exercising a real pending migration, not a no-op upgrade.
  assert.ok(!readFileSync(oldSchema, 'utf8').includes('androidAppDownloadEnabled'));
  assert.ok(readFileSync(candidateSchema, 'utf8').includes('androidAppDownloadEnabled'));
  run('docker', ['run', '--rm', '-d', '--name', container,
    '-e', 'POSTGRES_USER=square_test', '-e', 'POSTGRES_PASSWORD=square_test',
    '-e', 'POSTGRES_DB=upgrade_test', '-p', '127.0.0.1::5432', 'postgres:16-alpine']);
  created = true;
  let ready = false;
  for (let i = 0; i < 60; i++) {
    if (spawnSync('docker', ['exec', container, 'pg_isready', '-U', 'square_test', '-d', 'upgrade_test'],
      { stdio: 'ignore', timeout: 5000 }).status === 0) { ready = true; break; }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  assert.ok(ready, 'Disposable PostgreSQL did not become ready');
  const port = run('docker', ['port', container, '5432/tcp']).trim().match(/^127\.0\.0\.1:(\d+)$/)?.[1];
  assert.ok(port, 'Expected a dynamically assigned loopback-only port');
  const env = { ...process.env, DATABASE_URL: `postgresql://square_test:square_test@127.0.0.1:${port}/upgrade_test?schema=public` };
  const migrate = schema => run(prisma, ['migrate', 'deploy', '--schema', schema], { env });
  const sql = (statement, database = 'upgrade_test') => run('docker',
    ['exec', '-i', container, 'psql', '-X', '-U', 'square_test', '-d', database, '-v', 'ON_ERROR_STOP=1', '-At'],
    { input: statement }).trim();
  migrate(oldSchema);
  sql(`
    INSERT INTO "User" (id,email,name,"passwordHash","updatedAt")
      VALUES ('upgrade-member','upgrade@example.invalid','Independent member','fixture-hash',now());
    INSERT INTO "Post" (id,content,"authorId","updatedAt")
      VALUES ('upgrade-post','Preserve instance content','upgrade-member',now());
    INSERT INTO "Course" (id,title,description,"updatedAt") VALUES ('upgrade-course','Course','Content',now());
    INSERT INTO "Progress" (id,"userId","courseId",percentage,"completedLessons","updatedAt")
      VALUES ('upgrade-progress','upgrade-member','upgrade-course',50,'["lesson-one"]',now());
    INSERT INTO "PlatformSettings" (id,"platformName","primaryColor","allowSignups","updatedAt")
      VALUES ('default','Independent instance','#123456',false,now());
    INSERT INTO "TaskAttempt" (id,"userId","taskId","taskVersion",response,correct,"hintsUsed","idempotencyKey")
      VALUES ('upgrade-attempt','upgrade-member','instance.task',1,'{"answer":7}',true,1,'fixture-key');
    CREATE SCHEMA instance_extension;
    CREATE TABLE instance_extension.progress (member_id text PRIMARY KEY, state jsonb NOT NULL);
    INSERT INTO instance_extension.progress VALUES ('upgrade-member','{"level":3}');
  `);
  // Explicit canonical snapshots include credentials, content, progress, settings and plugin-owned data.
  const snapshotSql = `SELECT jsonb_build_object(
    'account',(SELECT to_jsonb(u) FROM "User" u WHERE id='upgrade-member'),
    'post',(SELECT to_jsonb(p) FROM "Post" p WHERE id='upgrade-post'),
    'course',(SELECT to_jsonb(c) FROM "Course" c WHERE id='upgrade-course'),
    'progress',(SELECT to_jsonb(p) FROM "Progress" p WHERE id='upgrade-progress'),
    'settings',(SELECT to_jsonb(s)-'androidAppDownloadEnabled'-'androidAppDownloadUrl' FROM "PlatformSettings" s WHERE id='default'),
    'attempt',(SELECT to_jsonb(a) FROM "TaskAttempt" a WHERE id='upgrade-attempt'),
    'extension',(SELECT to_jsonb(e) FROM instance_extension.progress e WHERE member_id='upgrade-member'))::text;`;
  const snapshot = sql(snapshotSql);
  const migrationHistory = sql('SELECT migration_name FROM "_prisma_migrations" ORDER BY migration_name;');
  const backup = run('docker', ['exec', container, 'pg_dump', '-U', 'square_test', '-d', 'upgrade_test', '-Fc'], { encoding: 'buffer' });
  assert.ok(backup.length > 0);
  migrate(candidateSchema);
  assert.equal(sql(snapshotSql), snapshot, 'Upgrade changed existing member or instance data');
  assert.equal(sql('SELECT "androidAppDownloadEnabled" = false AND "androidAppDownloadUrl" IS NULL FROM "PlatformSettings" WHERE id=\'default\';'), 't');
  assert.notEqual(sql('SELECT migration_name FROM "_prisma_migrations" ORDER BY migration_name;'), migrationHistory);
  console.log('PASS: real baseline-to-candidate Prisma upgrade preserves accounts/content/progress/settings/extension data');

  // Simulate a later migration that leaves a partial side effect before failing.
  const broken = join(candidate, 'prisma/migrations/20990101000000_recovery_fixture');
  mkdirSync(broken);
  writeFileSync(join(broken, 'migration.sql'), 'BEGIN;\nCREATE TABLE recovery_partial (id integer);\nCOMMIT;\nSELECT square_deliberate_missing_function();\n');
  const failure = spawnSync(prisma, ['migrate', 'deploy', '--schema', candidateSchema], {
    cwd: root, env, encoding: 'utf8', timeout: 120000,
  });
  assert.equal(failure.error, undefined);
  assert.equal(failure.status, 1, 'Injected migration failure must block promotion');
  assert.equal(sql("SELECT count(*) FROM \"_prisma_migrations\" WHERE migration_name='20990101000000_recovery_fixture' AND finished_at IS NULL;"), '1');
  assert.equal(sql("SELECT to_regclass('public.recovery_partial') IS NOT NULL;"), 't');
  console.log('PASS: partially applied failed migration blocks promotion');

  // Restore into a different empty database, preserving the failed candidate for diagnosis.
  sql('CREATE DATABASE recovered_test;', 'postgres');
  run('docker', ['exec', '-i', container, 'pg_restore', '-U', 'square_test', '-d', 'recovered_test',
    '--exit-on-error', '--no-owner', '--no-privileges'], { input: backup });
  assert.equal(sql(snapshotSql, 'recovered_test'), snapshot, 'Restored instance data differs from backup');
  assert.equal(sql('SELECT migration_name FROM "_prisma_migrations" ORDER BY migration_name;', 'recovered_test'), migrationHistory);
  assert.equal(sql("SELECT count(*) FROM information_schema.columns WHERE table_name='PlatformSettings' AND column_name='androidAppDownloadEnabled';", 'recovered_test'), '0');
  assert.equal(sql("SELECT to_regclass('public.recovery_partial') IS NULL;", 'recovered_test'), 't');
  console.log(`PASS: pg_dump/pg_restore recovers the baseline schema, migration history and member/extension data (${baseline})`);
  console.log('No production instance, published release, API/browser rollout or automatic schema downgrade was exercised.');
} finally {
  if (created) run('docker', ['rm', '-f', '-v', container]);
  rmSync(work, { recursive: true, force: true });
}
