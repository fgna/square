/** Runtime-neutral task validation; can be consumed by any Square plugin. */
const ID = /^[a-z0-9][a-z0-9._-]{0,127}$/;
const KEY = /^[a-zA-Z0-9_-]{8,128}$/;
export function validateNumericTask(task) {
  if (!task || typeof task !== 'object' || Array.isArray(task)
    || task.schemaVersion !== 1 || task.responseType !== 'number'
    || typeof task.id !== 'string' || !ID.test(task.id)
    || !Number.isSafeInteger(task.version) || task.version < 1
    || typeof task.prompt !== 'string' || !task.prompt.trim() || task.prompt.length > 2000
    || typeof task.expected !== 'number' || !Number.isFinite(task.expected)
    || (task.hints !== undefined && (!Array.isArray(task.hints)
      || task.hints.length > 5 || task.hints.some(h => typeof h !== 'string' || !h.trim() || h.length > 1000)))) {
    throw new TypeError('invalid_numeric_task');
  }
  return task;
}
export function publicNumericTask(task) {
  validateNumericTask(task);
  return {id: task.id, version: task.version, responseType: 'number',
    prompt: task.prompt, hintCount: task.hints?.length ?? 0};
}
export function validateAttemptInput(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)
    || Object.keys(body).some(k => !['taskId','taskVersion','idempotencyKey','response'].includes(k))
    || typeof body.taskId !== 'string' || !ID.test(body.taskId)
    || !Number.isSafeInteger(body.taskVersion) || body.taskVersion < 1
    || typeof body.idempotencyKey !== 'string' || !KEY.test(body.idempotencyKey)
    || typeof body.response !== 'number' || !Number.isFinite(body.response)) {
    throw new TypeError('invalid_attempt');
  }
  return body;
}
export function gradeNumericAttempt(task, body) {
  validateNumericTask(task);
  validateAttemptInput(body);
  if (task.id !== body.taskId || task.version !== body.taskVersion) {
    throw new TypeError('task_version_mismatch');
  }
  return body.response === task.expected;
}

/** Single- and multiple-choice grading. Correct answer IDs stay server-side. */
export function validateChoiceTask(task) {
  if (!task || typeof task !== 'object' || Array.isArray(task)
    || task.schemaVersion !== 1 || !['single_choice','multiple_choice'].includes(task.responseType)
    || typeof task.id !== 'string' || !ID.test(task.id)
    || !Number.isSafeInteger(task.version) || task.version < 1
    || typeof task.prompt !== 'string' || !task.prompt.trim() || task.prompt.length > 2000
    || !Array.isArray(task.options) || task.options.length < 2 || task.options.length > 12
    || task.options.some(o => !o || typeof o.id !== 'string' || !ID.test(o.id)
      || typeof o.label !== 'string' || !o.label.trim() || o.label.length > 500)
    || new Set(task.options.map(o => o.id)).size !== task.options.length
    || !Array.isArray(task.correctOptionIds) || task.correctOptionIds.length < 1
    || (task.responseType === 'single_choice' && task.correctOptionIds.length !== 1)
    || new Set(task.correctOptionIds).size !== task.correctOptionIds.length
    || task.correctOptionIds.some(id => !task.options.some(o => o.id === id))
    || (task.hints !== undefined && (!Array.isArray(task.hints) || task.hints.length > 5
      || task.hints.some(h => typeof h !== 'string' || !h.trim() || h.length > 1000)))) {
    throw new TypeError('invalid_choice_task');
  }
  return task;
}
export function publicChoiceTask(task) {
  validateChoiceTask(task);
  return {id:task.id,version:task.version,responseType:task.responseType,
    prompt:task.prompt,options:task.options.map(({id,label}) => ({id,label})),
    hintCount:task.hints?.length ?? 0};
}
export function gradeChoiceAttempt(task, body) {
  validateChoiceTask(task);
  if (!body || typeof body !== 'object' || Array.isArray(body)
    || Object.keys(body).some(k => !['taskId','taskVersion','idempotencyKey','response'].includes(k))
    || body.taskId !== task.id || body.taskVersion !== task.version
    || typeof body.idempotencyKey !== 'string' || !KEY.test(body.idempotencyKey)
    || !Array.isArray(body.response)
    || body.response.length < 1 || body.response.length > task.options.length
    || (task.responseType === 'single_choice' && body.response.length !== 1)
    || body.response.some(id => typeof id !== 'string' || !task.options.some(o=>o.id===id))
    || new Set(body.response).size !== body.response.length) {
    throw new TypeError('invalid_choice_attempt');
  }
  return body.response.length === task.correctOptionIds.length
    && body.response.every(id => task.correctOptionIds.includes(id));
}
