// Square CI only: isolated *external* Turbo Mathe consumer integration.
// No plugin code or secrets are committed into Square.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

assert.equal(process.env.SQUARE_E2E_DISPOSABLE, '1', 'Disposable database required');
const api=process.env.SQUARE_E2E_API_URL;
const memberEmail=process.env.SQUARE_TEST_EMAIL;
const memberPassword=process.env.SQUARE_TEST_PASSWORD;
const adminToken=process.env.SQUARE_E2E_ADMIN_TOKEN;
for(const [name,value] of Object.entries({api,memberEmail,memberPassword,adminToken})) {
  assert.ok(value, 'Missing isolated CI configuration: '+name);
}
assert.equal(new URL(api).hostname,'127.0.0.1','Refuse non-loopback test API');
async function post(path,body,token) {
  const response=await fetch(api+path,{method:'POST',headers:{
    'content-type':'application/json',...(token?{authorization:'Bearer '+token}:{})
  },body:JSON.stringify(body)});
  const json=await response.json().catch(()=>({}));
  assert.ok(response.ok(), path+' responded HTTP '+response.status);
  return json;
}
async function get(path,token) {
  const response=await fetch(api+path,{headers:{authorization:'Bearer '+token}});
  assert.ok(response.ok(),path+' responded HTTP '+response.status);
  return response.json();
}
const session=await post('/api/auth/login',{email:memberEmail,password:memberPassword});
const token=session.accessToken;
assert.ok(token && session.user?.id,'Member login and identity required');
await post('/api/gamification/admin/rewards',{code:'turbo_math_correct',amount:1},adminToken);
const key=randomUUID();
const task={taskId:'ten-friends.7-plus',taskVersion:1,response:3,idempotencyKey:key};
const before=await get('/api/gamification/wallet',token);
const answered=await post('/api/p/turbo-mathe/attempts',task,token);
assert.equal(answered.correct,true,'Server-verified correct math answer required');
const after=await get('/api/gamification/wallet',token);
assert.equal(after.balance,before.balance+1,'Real task completion must grant exactly one coin');
const replay=await post('/api/p/turbo-mathe/attempts',task,token);
assert.equal(replay.correct,true);
const afterReplay=await get('/api/gamification/wallet',token);
assert.equal(afterReplay.balance,after.balance,'Duplicate task must not grant another coin');
const history=await get('/api/p/turbo-mathe/attempts',token);
assert.ok(Array.isArray(history) && history.some(row=>row.taskId===task.taskId && row.correct),
  'Durable source task attempt must be accessible');
const txs=await get('/api/gamification/transactions',token);
assert.ok(Array.isArray(txs) && txs.some(row=>row.delta===1),'Reward ledger entry missing');
console.log('PASS: external Turbo Mathe verified task => Square coin once, retry remains idempotent, task and ledger persisted');
