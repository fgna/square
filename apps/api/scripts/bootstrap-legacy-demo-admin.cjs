// One-time admin bootstrap for old isolated demos without demo.env.
// Uses ONLY the running postgres service belonging to the named Core demo.
// Does not read process secrets, change schemas, or restart containers.
const { execFileSync } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const { mkdirSync, openSync, writeFileSync, closeSync, unlinkSync } = require('node:fs');
const { resolve } = require('node:path');
const argon2 = require('argon2');

function docker(args, input) {
  return execFileSync('docker', args, {
    encoding: 'utf8', input, timeout: 15000,
    stdio: ['pipe', 'pipe', 'pipe'],
  }).trim();
}
function sql(container, query) {
  // No database passwords leave the container; postgres uses local trust
  // for the dedicated 'demo' role inside its own container.
  return docker(['exec', '-i', container, 'psql', '-X', '-v', 'ON_ERROR_STOP=1',
    '-U', 'demo', '-d', 'community_core_demo', '-t', '-A'], query + '\n');
}
async function main() {
  if (process.env.NODE_ENV === 'production') throw new Error('Production bootstrap prohibited');
  const containers = docker(['ps', '-q',
    '--filter', 'label=com.docker.compose.project=community-core-local-demo',
    '--filter', 'label=com.docker.compose.service=postgres',
    '--filter', 'status=running']).split('\n').filter(Boolean);
  if (containers.length !== 1) throw new Error('Expected exactly one running isolated Core postgres container');
  const container = containers[0];
  const db = sql(container, "SELECT current_database() || ':' || current_user");
  if (db !== 'community_core_demo:demo') throw new Error('Unexpected database context');

  const count = Number(sql(container,
    'SELECT count(*) FROM "local_demo"."User" WHERE role = \'ADMIN\''));
  if (!Number.isSafeInteger(count)) throw new Error('Cannot verify admin count');
  if (count > 0) {
    console.log('An administrator already exists; no changes made.');
    return;
  }

  const email = 'admin@community.local';
  const existing = Number(sql(container,
    'SELECT count(*) FROM "local_demo"."User" WHERE email = \'admin@community.local\''));
  if (existing !== 0) throw new Error('Reserved administrator email already taken; no changes made');

  const password = randomBytes(32).toString('base64url');
  const hash = await argon2.hash(password);
  const state = resolve(process.env.CORE_DEMO_ROOT, '.local-community');
  mkdirSync(state, { recursive: true, mode: 0o700 });
  const credentials = resolve(state, 'admin-credentials.txt');
  const fd = openSync(credentials, 'wx', 0o600);
  try {
    writeFileSync(fd, 'Local demo administrator\nEmail: ' + email +
      '\nPassword: ' + password + '\n');
  } finally {
    closeSync(fd);
  }

  try {
    // All values except the generated argon2 hash are fixed literals.
    const safeHash = hash.replace(/'/g, "''");
    const result = sql(container, `
      INSERT INTO "local_demo"."User"
        ("id", "email", "name", "passwordHash", "role", "isActive", "createdAt", "updatedAt")
      SELECT 'demo-admin-' || md5(random()::text || clock_timestamp()::text),
        'admin@community.local', 'Demo Administrator', '${safeHash}', 'ADMIN', true, now(), now()
      WHERE NOT EXISTS (SELECT 1 FROM "local_demo"."User" WHERE role = 'ADMIN')
        AND NOT EXISTS (SELECT 1 FROM "local_demo"."User" WHERE email = 'admin@community.local')
      RETURNING "email";`);
    if (!result.includes(email)) throw new Error('Admin not inserted; another admin may exist');
  } catch (error) {
    unlinkSync(credentials);
    throw error;
  }
  console.log('Administrator created: ' + email);
  console.log('Credentials stored at ' + credentials + ' (mode 0600).');
}
main().catch(err => { console.error(err.message); process.exitCode = 1; });
