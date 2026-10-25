import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateNumericTask, publicNumericTask, validateAttemptInput, gradeNumericAttempt } from './tasks.mjs';
const task = {schemaVersion:1,id:'sample.quantity',version:1,responseType:'number',prompt:'How many objects are shown?',expected:4,hints:['Count carefully.']};
const attempt = {taskId:task.id,taskVersion:1,idempotencyKey:'request_0001',response:4};
test('public task hides answer and hints',()=>{
  assert.deepEqual(publicNumericTask(task),{id:task.id,version:1,responseType:'number',prompt:task.prompt,hintCount:1});
  assert.ok(!JSON.stringify(publicNumericTask(task)).includes('"expected"'));
});
test('numeric validation and exact grading',()=>{
  assert.equal(gradeNumericAttempt(task,attempt),true);
  assert.equal(gradeNumericAttempt(task,{...attempt,response:5}),false);
  assert.throws(()=>gradeNumericAttempt(task,{...attempt,taskVersion:2}),/task_version_mismatch/);
});
test('reject invalid definitions and nonfinite responses',()=>{
  assert.throws(()=>validateNumericTask({...task,expected:Infinity}),/invalid_numeric_task/);
  assert.throws(()=>validateNumericTask({...task,id:'../other'}),/invalid_numeric_task/);
  assert.throws(()=>validateAttemptInput({...attempt,response:NaN}),/invalid_attempt/);
  assert.throws(()=>validateAttemptInput({...attempt,memberId:'other-user'}),/invalid_attempt/);
  assert.throws(()=>validateAttemptInput({...attempt,hintsUsed:0}),/invalid_attempt/);
});
