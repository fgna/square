// Synthetic upgrade fixture for #107. Run only against disposable PostgreSQL.
// Usage: node scripts/test-gamification-upgrade.mjs seed|verify
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(new URL('../apps/api/package.json', import.meta.url));
const { PrismaClient } = require('@prisma/client');
if (process.env.GAMIFICATION_UPGRADE_DISPOSABLE_DB !== '1') {
  throw new Error('Refusing to run without explicit disposable DB marker');
}
const db = new PrismaClient();
const id = 'square-107-upgrade-user';
const attemptId = 'square-107-upgrade-attempt';
const hintId = 'square-107-upgrade-hint';
try {
  if (process.argv[2] === 'seed') {
    await db.user.create({data: {id,email:'square-107-upgrade@example.invalid',name:'Synthetic upgrade user'}});
    await db.taskAttempt.create({data:{id:attemptId,userId:id,taskId:'synthetic-quiz',taskVersion:1,
      response:{answer:4},correct:true,hintsUsed:1,idempotencyKey:'square-107-attempt'}});
    await db.taskHintSession.create({data:{id:hintId,userId:id,taskId:'synthetic-quiz',taskVersion:1,
      hintsUsed:1,idempotencyKey:'square-107-hint'}});
    console.log('Synthetic task history seeded before migration');
  } else if (process.argv[2] === 'verify') {
    const attempt = await db.taskAttempt.findUniqueOrThrow({where:{id:attemptId}});
    assert.equal(attempt.userId,id);
    assert.deepEqual(attempt.response,{answer:4});
    assert.equal(attempt.correct,true);
    assert.equal(attempt.hintsUsed,1);
    const hint = await db.taskHintSession.findUniqueOrThrow({where:{id:hintId}});
    assert.equal(hint.userId,id);
    assert.equal(hint.hintsUsed,1);
    const wallet = await db.gameWallet.findUnique({where:{userId:id}});
    assert.equal(wallet,null);
    console.log('PASS: pre-upgrade task attempt/hint data preserved; new wallet is additive');
  } else {
    throw new Error('Expected seed or verify');
  }
} finally {
  await db.$disconnect();
}
