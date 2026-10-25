import { BadRequestException, Controller, Get, Post, Body } from '@nestjs/common';
import type { ApiPlugin } from '@community/plugin-sdk/api';

const TASKS = [
  { id: 'sample.count', version: 1, responseType: 'number' as const,
    prompt: 'How many sides does a triangle have?', expected: 3, hintCount: 0 },
  { id: 'sample.color', version: 1, responseType: 'single_choice' as const,
    prompt: 'Which of these is a primary color of light?',
    options: [{ id: 'red', label: 'Red' }, { id: 'brown', label: 'Brown' }, { id: 'gray', label: 'Gray' }],
    correctOptionIds: ['red'], hintCount: 0 },
  { id: 'sample.shapes', version: 1, responseType: 'multiple_choice' as const,
    prompt: 'Which shapes have four sides?',
    options: [{ id: 'square', label: 'Square' }, { id: 'triangle', label: 'Triangle' }, { id: 'rectangle', label: 'Rectangle' }],
    correctOptionIds: ['square', 'rectangle'], hintCount: 0 },
];

function publicTask(task: typeof TASKS[number]) {
  if (task.responseType === 'number') {
    return { id: task.id, version: task.version, responseType: task.responseType,
      prompt: task.prompt, hintCount: task.hintCount };
  }
  return { id: task.id, version: task.version, responseType: task.responseType,
    prompt: task.prompt, options: task.options, hintCount: task.hintCount };
}

/** Neutral examples only. Answer keys never leave the server. */
const plugin: ApiPlugin = {
  register({ CurrentUser, data }) {
    @Controller()
    class TasksController {
      @Get('tasks')
      tasks() {
        return TASKS.map(publicTask);
      }

      @Get('tasks/first')
      first() {
        return publicTask(TASKS[0]);
      }

      @Get('attempts')
      history(@CurrentUser('id') memberId: string) {
        return data.tasks.list(memberId);
      }

      @Post('attempts')
      async submit(@CurrentUser('id') memberId: string, @Body() body: unknown) {
        if (!body || typeof body !== 'object' || Array.isArray(body)) throw new BadRequestException();
        const input = body as Record<string, unknown>;
        const task = TASKS.find(item => item.id === input.taskId && item.version === input.taskVersion);
        if (!task || Object.keys(input).some(k => !['taskId', 'taskVersion', 'idempotencyKey', 'response'].includes(k))
          || typeof input.idempotencyKey !== 'string' || !/^[a-zA-Z0-9_-]{8,128}$/.test(input.idempotencyKey)) {
          throw new BadRequestException('Invalid task submission');
        }
        let correct: boolean;
        let response: number | string[];
        if (task.responseType === 'number') {
          if (typeof input.response !== 'number' || !Number.isFinite(input.response)) {
            throw new BadRequestException('Invalid numeric response');
          }
          response = input.response;
          correct = response === task.expected;
        } else {
          const values = input.response;
          if (!Array.isArray(values) || values.length < 1 || values.length > task.options.length
            || (task.responseType === 'single_choice' && values.length !== 1)
            || values.some((value: unknown) => typeof value !== 'string' || !task.options.some(option => option.id === value))
            || new Set(values).size !== values.length) {
            throw new BadRequestException('Invalid choice response');
          }
          response = values as string[];
          correct = response.length === task.correctOptionIds.length
            && response.every(value => task.correctOptionIds.includes(value));
        }
        const record = await data.tasks.record(memberId, {
          taskId: task.id, taskVersion: task.version, idempotencyKey: input.idempotencyKey,
          response, correct, hintsUsed: 0,
        });
        return { id: record.id, correct: record.correct, hintsUsed: record.hintsUsed };
      }
    }
    return { controllers: [TasksController] };
  },
};
export default plugin;
