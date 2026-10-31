// CI-only. Never run with a database containing real members.
const { PrismaClient, Role } = require('@prisma/client');
const argon2 = require('argon2');
const { createHash } = require('node:crypto');
async function main() {
  const url = new URL(process.env.DATABASE_URL || 'invalid');
  if (process.env.SQUARE_E2E_DISPOSABLE !== '1' ||
      !['127.0.0.1','localhost'].includes(url.hostname) ||
      url.pathname !== '/square_playwright_test' ||
      url.searchParams.get('schema') !== 'public') {
    throw new Error('Refusing to seed anything outside isolated Square Playwright CI database');
  }
  const db = new PrismaClient();
  try {
    const users = [
      { email:'square-playwright-admin@example.invalid',role:Role.ADMIN, env:'SQUARE_E2E_ADMIN_PASSWORD' },
      { email:'square-playwright-member@example.invalid',role:Role.MEMBER, env:'SQUARE_TEST_PASSWORD' },
    ];
    for (const u of users) {
      const pass = process.env[u.env];
      if (!pass || pass.length < 20) throw new Error('Missing CI-generated credentials');
      await db.user.create({data:{
        email:u.email,name:'Synthetic Playwright '+u.role,role:u.role,
        passwordHash:await argon2.hash(pass),
      }});
    }
  } finally { await db.$disconnect(); }
  console.log('Created two synthetic Square accounts in disposable database');
}
main().catch(e=>{ console.error(e.message); process.exitCode=1; });
