import { createHash, randomBytes } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export type TestAccount = { email: string; password: string; newlyGenerated: boolean; file?: string };
const configRoot = () => join(homedir(), '.config', 'turbo-mathe');

export function accountFile(origin: string, scope = '', root = configRoot()): string {
  if (scope && !/^[a-z][a-z0-9-]{0,47}$/.test(scope)) throw new Error('Invalid synthetic account scope');
  // Preserve the legacy unscoped account filename exactly.
  const key = scope ? `${origin}\0${scope}` : origin;
  const hash = createHash('sha256').update(key).digest('hex').slice(0, 12);
  return join(root, `playwright-account-${hash}.json`);
}

export function testAccount(origin: string, scope = '', env: NodeJS.ProcessEnv = process.env, root = configRoot()): TestAccount {
  const file = accountFile(origin, scope, root);
  // A scoped consumer never silently reuses the global account's learner state.
  const prefix = scope ? `SQUARE_TEST_${scope.replace(/-/g, '_').toUpperCase()}_` : 'SQUARE_TEST_';
  const email = env[`${prefix}EMAIL`];
  const password = env[`${prefix}PASSWORD`];
  if (email || password) {
    if (!email || !password) throw new Error(`Both ${prefix}EMAIL and ${prefix}PASSWORD are required`);
    return { email, password, newlyGenerated: false };
  }
  if (existsSync(file)) {
    const data = JSON.parse(readFileSync(file, 'utf8'));
    if (typeof data.email !== 'string' || typeof data.password !== 'string') throw new Error('Invalid synthetic account file');
    return { email: data.email, password: data.password, newlyGenerated: false };
  }
  if (env.SQUARE_TEST_ALLOW_SIGNUP !== '1') {
    throw new Error('No synthetic member exists for this scope. Set SQUARE_TEST_ALLOW_SIGNUP=1 only for an authorized isolated signup-enabled test instance');
  }
  return {
    email: `square-playwright-${randomBytes(10).toString('hex')}@example.test`,
    password: 'T' + randomBytes(24).toString('base64url') + 'a9!',
    newlyGenerated: true,
    file,
  };
}
