import { BadRequestException, Controller, Get, Post, Body } from '@nestjs/common';
import type { ApiPlugin } from '@community/plugin-sdk/api';

const TASK = {
  id: 'sample.count', version: 1, responseType: 'number' as const,
  prompt: 'How many sides does a triangle have?', expected: 3, hintCount: 0,
};

/** Neutral example only. The answer key never leaves this server module. */
const plugin: ApiPlugin = {
  register({ CurrentUser, data }) {
    @Controller()
    class TasksController {
      @Get('tasks/first')
      first() {
        const { expected, ...publicTask } = TASK;
        return publicTask;
      }

      @Get('attempts')
      history(@CurrentUser('id') memberId: string) {
        return data.tasks.list(memberId);
      }

      @Post('attempts')
      async submit(@CurrentUser('id') memberId: string, @Body() body: unknown) {
        if (!body || typeof body !== 'object' || Array.isArray(body)) throw new BadRequestException();
        const input = body as Record<string, unknown>;
        if (Object.keys(input).some(k => !['taskId', 'taskVersion', 'idempotencyKey', 'response'].includes(k))
          || input.taskId !== TASK.id || input.taskVersion !== TASK.version
          || typeof input.idempotencyKey !== 'string' || !/^[a-zA-Z0-9_-]{8,128}$/.test(input.idempotencyKey)
          || typeof input.response !== 'number' || !Number.isFinite(input.response)) {
          throw new BadRequestException('Invalid task submission');
        }
        const record = await data.tasks.record(memberId, {
          taskId: TASK.id, taskVersion: TASK.version, idempotencyKey: input.idempotencyKey,
          response: input.response, correct: input.response === TASK.expected, hintsUsed: 0,
        });
        return { id: record.id, correct: record.correct, hintsUsed: record.hintsUsed };
      }
    }
    return { controllers: [TasksController] };
  },
};
export default plugin;
