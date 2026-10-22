// Bootstrap one isolated local-demo administrator; never use in production.
// Existing administrators and member accounts are left untouched.
const { PrismaClient, Role } = require('@prisma/client');
const argon2 = require('argon2');
const { randomBytes } = require('node:crypto');
const { mkdirSync, writeFileSync, existsSync, unlinkSync } = require('node:fs');
const { resolve } = require('node:path');

async function main() {
  const raw = process.env.DATABASE_URL;
  if (!raw || process.env.NODE_ENV === 'production') {
    throw new Error('Refusing admin bootstrap: isolated development database required');
  }
  const url = new URL(raw);
  if (!['127.0.0.1', 'localhost'].includes(url.hostname) ||
      url.port !== '5439' || url.searchParams.get('schema') !== 'local_demo' ||
      url.pathname !== '/community_core_demo') {
    throw new Error('Refusing admin bootstrap outside dedicated local demo database');
  }

  const prisma = new PrismaClient();
  try {
    if (await prisma.user.count({ where: { role: Role.ADMIN } }) > 0) {
      console.log('Demo administrator already exists; no changes made.');
      return;
    }

    const email = 'admin@community.local';
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new Error('Reserved demo admin email already belongs to a non-admin user');
    }

    const stateDir = resolve(__dirname, '../../../.local-community');
    mkdirSync(stateDir, { recursive: true, mode: 0o700 });
    const credentialPath = resolve(stateDir, 'admin-credentials.txt');
    if (existsSync(credentialPath)) throw new Error('Refusing bootstrap: old admin credentials file already exists');

    // Reserve credentials before inserting the admin. A disk/write failure
    // must never leave an inaccessible ADMIN account behind.
    const password = randomBytes(32).toString('base64url');
    const passwordHash = await argon2.hash(password);
    writeFileSync(credentialPath,
      'Demo administrator (local installation only)\\n' +
      'Email: ' + email + '\\nPassword: ' + password + '\\n',
      { mode: 0o600, flag: 'wx' });
    try {
      await prisma.user.create({
        data: { email, name: 'Demo Administrator', role: Role.ADMIN,
          isActive: true, passwordHash },
      });
    } catch (error) {
      unlinkSync(credentialPath);
      throw error;
    }
    console.log('Demo administrator created. Credentials saved locally to ' +
      credentialPath + ' (permissions 0600).');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
