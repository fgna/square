import { ConflictException, Injectable } from '@nestjs/common';
import type { PluginTaskAttempts, PluginTaskAttemptRecord, PluginTaskAttemptCreate } from '@community/plugin-sdk/api';
import { PrismaService } from '../../prisma/prisma.service';

/** Immutable attempts, always scoped to the authenticated member by the calling plugin. */
@Injectable()
export class TaskAttemptStore implements PluginTaskAttempts {
  constructor(private readonly prisma: PrismaService) {}

  async record(userId: string, input: PluginTaskAttemptCreate): Promise<PluginTaskAttemptRecord> {
    if (!userId || !input || !/^[a-z0-9][a-z0-9._-]{0,127}$/.test(input.taskId)
      || !Number.isSafeInteger(input.taskVersion) || input.taskVersion < 1
      || !/^[a-zA-Z0-9_-]{8,128}$/.test(input.idempotencyKey)
      || typeof input.correct !== 'boolean'
      || !Number.isSafeInteger(input.hintsUsed) || input.hintsUsed < 0 || input.hintsUsed > 5
      || !((typeof input.response === 'number' && Number.isFinite(input.response))
        || (Array.isArray(input.response) && input.response.length > 0 && input.response.length <= 12
          && input.response.every(x => typeof x === 'string' && /^[a-z0-9][a-z0-9._-]{0,127}$/.test(x))
          && new Set(input.response).size === input.response.length))) {
      throw new ConflictException('Invalid task attempt');
    }
    const data = {userId, taskId:input.taskId, taskVersion:input.taskVersion,
      response:input.response, correct:input.correct, hintsUsed:input.hintsUsed,
      idempotencyKey:input.idempotencyKey};
    // Atomic unique insert: duplicate deliveries do not generate another attempt.
    // If reused with a different payload, fail rather than return misleading success.
    try {
      return await this.prisma.taskAttempt.create({data}) as unknown as PluginTaskAttemptRecord;
    } catch (err) {
      if (!err || typeof err !== 'object' || !('code' in err) || err.code !== 'P2002') throw err;
      const existing = await this.prisma.taskAttempt.findUnique({
        where:{userId_idempotencyKey:{userId,idempotencyKey:input.idempotencyKey}},
      });
      if (!existing) throw err;
      const same = existing.taskId === data.taskId && existing.taskVersion === data.taskVersion
        && JSON.stringify(existing.response) === JSON.stringify(data.response)
        && existing.correct === data.correct && existing.hintsUsed === data.hintsUsed;
      if (!same) throw new ConflictException('Idempotency key already used for a different attempt');
      return existing as unknown as PluginTaskAttemptRecord;
    }
  }

  list(userId: string, taskId?: string): Promise<PluginTaskAttemptRecord[]> {
    if (!userId || (taskId !== undefined && !/^[a-z0-9][a-z0-9._-]{0,127}$/.test(taskId))) {
      throw new ConflictException('Invalid member or task');
    }
    return this.prisma.taskAttempt.findMany({
      where:{userId,...(taskId ? {taskId}:{})},
      orderBy:[{createdAt:'desc'},{id:'desc'}],take:100,
    }) as unknown as Promise<PluginTaskAttemptRecord[]>;
  }
}
