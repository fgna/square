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

import {validateChoiceTask, publicChoiceTask, gradeChoiceAttempt} from './tasks.mjs';
const choice = {schemaVersion:1,id:'sample.colors',version:1,responseType:'multiple_choice',
  prompt:'Select the primary colors.',options:[{id:'red',label:'Red'},{id:'blue',label:'Blue'},{id:'green',label:'Green'}],
  correctOptionIds:['red','blue'],hints:['Consider the color model.']};
const answer = {taskId:choice.id,taskVersion:1,idempotencyKey:'choice_req_001',response:['blue','red']};
test('multiple choice uses order-independent exact set comparison',()=>{
  assert.equal(gradeChoiceAttempt(choice,answer),true);
  assert.equal(gradeChoiceAttempt(choice,{...answer,response:['red']}),false);
  assert.equal(gradeChoiceAttempt(choice,{...answer,response:['red','green']}),false);
});
test('single choice requires exactly one selection',()=>{
  const single={...choice,responseType:'single_choice',correctOptionIds:['red']};
  assert.equal(gradeChoiceAttempt(single,{...answer,response:['red']}),true);
  assert.throws(()=>gradeChoiceAttempt(single,answer),/invalid_choice_attempt/);
});
test('choice options are public but answer keys are private',()=>{
  const pub=publicChoiceTask(choice);
  assert.equal(pub.hintCount,1);
  assert.equal(pub.options.length,3);
  assert.equal('correctOptionIds' in pub,false);
  assert.equal('hints' in pub,false);
});
test('invalid choice answers and duplicate options are rejected',()=>{
  assert.throws(()=>gradeChoiceAttempt(choice,{...answer,response:['red','red']}),/invalid_choice_attempt/);
  assert.throws(()=>gradeChoiceAttempt(choice,{...answer,response:['unknown']}),/invalid_choice_attempt/);
  assert.throws(()=>gradeChoiceAttempt(choice,{...answer,memberId:'another'}),/invalid_choice_attempt/);
  assert.throws(()=>validateChoiceTask({...choice,correctOptionIds:['unknown']}),/invalid_choice_task/);
  assert.throws(()=>validateChoiceTask({...choice,options:[choice.options[0],choice.options[0]]}),/invalid_choice_task/);
});
