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
