// Synthetic upgrade fixture for #107. Run only against disposable PostgreSQL.
// Usage: node scripts/test-gamification-upgrade.mjs seed|verify|economy-seed|economy-verify
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
  } else if (process.argv[2] === 'economy-seed') {
    await db.gameRewardDefinition.create({data:{code:'square-107-upgrade-reward',amount:20}});
    await db.gameWallet.create({data:{userId:id,balance:13}});
    await db.gameItem.create({data:{id:'square-107-upgrade-item',name:'Synthetic badge',price:7,cosmetic:true}});
    await db.gameRewardEvent.create({data:{userId:id,rewardCode:'square-107-upgrade-reward',
      eventKey:'square-107-upgrade-event',amount:20}});
    await db.gameTransaction.createMany({data:[
      {userId:id,delta:20,kind:'REWARD',reference:'square-107-upgrade-reward-transaction'},
      {userId:id,delta:-7,kind:'PURCHASE',reference:'square-107-upgrade-purchase-transaction'},
    ]});
    await db.gameInventory.create({data:{userId:id,itemId:'square-107-upgrade-item'}});
    await db.gamePurchase.create({data:{userId:id,itemId:'square-107-upgrade-item',
      requestKey:'square-107-upgrade-purchase',price:7}});
    await db.gameEquipment.create({data:{userId:id,slot:'badge',itemId:'square-107-upgrade-item',variant:'blue'}});
    console.log('Synthetic economy balance, ledger, inventory and equipment seeded');
  } else if (process.argv[2] === 'economy-verify') {
    assert.equal((await db.gameWallet.findUniqueOrThrow({where:{userId:id}})).balance,13);
    const txs=await db.gameTransaction.findMany({where:{userId:id}});
    assert.equal(txs.length,2);
    assert.equal(txs.reduce((sum,t)=>sum+t.delta,0),13);
    assert.equal(await db.gameRewardEvent.count({where:{userId:id}}),1);
    assert.equal(await db.gamePurchase.count({where:{userId:id}}),1);
    assert.equal(await db.gameInventory.count({where:{userId:id,itemId:'square-107-upgrade-item'}}),1);
    const equipped=await db.gameEquipment.findUniqueOrThrow({where:{userId_slot:{userId:id,slot:'badge'}}});
    assert.equal(equipped.itemId,'square-107-upgrade-item');
    assert.equal(equipped.variant,'blue');
    assert.equal((await db.taskAttempt.findUniqueOrThrow({where:{id:attemptId}})).correct,true);
    console.log('PASS: economy balances, ledger, inventory, equipment and task history survive re-deploy');
  } else {
    throw new Error('Expected seed, verify, economy-seed or economy-verify');
  }
} finally {
  await db.$disconnect();
}
