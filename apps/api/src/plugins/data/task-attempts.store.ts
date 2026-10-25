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
        && (Array.isArray(existing.response) && Array.isArray(data.response)
          ? JSON.stringify([...existing.response].sort()) === JSON.stringify([...data.response].sort())
          : JSON.stringify(existing.response) === JSON.stringify(data.response))
        && existing.correct === data.correct && existing.hintsUsed === data.hintsUsed;
      if (!same) throw new ConflictException('Idempotency key already used for a different attempt');
      return existing as unknown as PluginTaskAttemptRecord;
    }
  }

  private validateHintSession(userId: string, taskId: string, taskVersion: number, idempotencyKey: string) {
    if (!userId || !/^[a-z0-9][a-z0-9._-]{0,127}$/.test(taskId)
      || !Number.isSafeInteger(taskVersion) || taskVersion < 1
      || !/^[a-zA-Z0-9_-]{8,128}$/.test(idempotencyKey)) {
      throw new ConflictException('Invalid task hint session');
    }
  }

  async revealHint(userId: string, taskId: string, taskVersion: number, idempotencyKey: string, hintCount: number): Promise<number> {
    this.validateHintSession(userId, taskId, taskVersion, idempotencyKey);
    if (!Number.isSafeInteger(hintCount) || hintCount < 1 || hintCount > 5) {
      throw new ConflictException('Invalid hint count');
    }
    const where = { userId_idempotencyKey: { userId, idempotencyKey } };
    // Once a response is recorded, further hints cannot change its provenance.
    const submitted = await this.prisma.taskAttempt.findUnique({ where });
    if (submitted) throw new ConflictException('Attempt has already been submitted');
    // Create the first reveal atomically. Concurrent first reveals compete for the same unique key.
    try {
      await this.prisma.taskHintSession.create({
        data: { userId, taskId, taskVersion, idempotencyKey, hintsUsed: 1 },
      });
      return 1;
    } catch (error) {
      if (!error || typeof error !== 'object' || !('code' in error) || error.code !== 'P2002') throw error;
    }
    const existing = await this.prisma.taskHintSession.findUnique({ where });
    if (!existing || existing.taskId !== taskId || existing.taskVersion !== taskVersion) {
      throw new ConflictException('Hint session key already used for a different task');
    }
    if (existing.hintsUsed >= hintCount) return existing.hintsUsed;
    // Conditional update prevents the counter exceeding the server-defined hint count.
    await this.prisma.taskHintSession.updateMany({
      where: { userId, idempotencyKey, taskId, taskVersion, hintsUsed: { lt: hintCount } },
      data: { hintsUsed: { increment: 1 } },
    });
    const updated = await this.prisma.taskHintSession.findUnique({ where });
    return updated!.hintsUsed;
  }

  async hintUsage(userId: string, taskId: string, taskVersion: number, idempotencyKey: string): Promise<number> {
    this.validateHintSession(userId, taskId, taskVersion, idempotencyKey);
    const session = await this.prisma.taskHintSession.findUnique({
      where: { userId_idempotencyKey: { userId, idempotencyKey } },
    });
    if (session && (session.taskId !== taskId || session.taskVersion !== taskVersion)) {
      throw new ConflictException('Hint session key already used for a different task');
    }
    return session?.hintsUsed ?? 0;
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
