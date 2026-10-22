import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { EventsService, recordingCutoff } from './events.service';

describe('recordings: attachments and one-year retention', () => {
  let prisma: any;
  let service: EventsService;
  const now = new Date('2026-10-14T12:00:00Z');

  beforeEach(() => {
    vi.stubEnv('RECORDING_RETENTION_DAYS', '365');
    prisma = {
      recording: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'r1', createdAt: now, attachments: [{ id: 'a1', url: '/uploads/uploads/x/slides.pdf' }] },
        ]),
        count: vi.fn().mockResolvedValue(1),
        findUnique: vi.fn(),
        deleteMany: vi.fn().mockResolvedValue({ count: 2 }),
      },
      upload: { findUnique: vi.fn() },
      recordingAttachment: { findMany: vi.fn().mockResolvedValue([{ url: '/uploads/uploads/x/old.pdf' }]), findFirst: vi.fn().mockResolvedValue(null), create: vi.fn((a) => ({ id: 'a2', ...a.data })), findUnique: vi.fn(), delete: vi.fn() },
    };
    service = new EventsService(prisma, { send: vi.fn() } as any);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('lists only recordings younger than a year, with signed attachment links and the end date', async () => {
    const result = await service.findAllRecordings();

    const where = prisma.recording.findMany.mock.calls[0][0].where;
    expect(where.createdAt.gte.getTime()).toBeGreaterThan(Date.now() - (365 + 1) * 86_400_000);
    expect(prisma.recording.count).toHaveBeenCalledWith({ where });
    const rec = result.data[0];
    expect(rec.attachments[0].url).toMatch(/\/uploads\/uploads\/x\/slides\.pdf\?exp=\d+&sig=[0-9a-f]+$/);
    expect(rec.availableUntil?.toISOString()).toBe('2027-10-14T12:00:00.000Z');
  });

  it('deletes recordings older than a year', async () => {
    const count = await service.deleteExpiredRecordings(now);

    expect(count).toBe(2);
    expect(prisma.recording.deleteMany).toHaveBeenCalledWith({ where: { createdAt: { lt: recordingCutoff(now) } } });
    expect(prisma.recordingAttachment.findMany).toHaveBeenCalledWith({ where: { recording: { createdAt: { lt: recordingCutoff(now) } } }, select: { url: true } });
    expect(recordingCutoff(now)?.toISOString()).toBe('2025-10-14T12:00:00.000Z');
  });

  it('keeps recordings until an admin deletes them when no retention is set', async () => {
    vi.stubEnv('RECORDING_RETENTION_DAYS', '');

    const result = await service.findAllRecordings();
    const count = await service.deleteExpiredRecordings(now);

    expect(prisma.recording.findMany.mock.calls[0][0].where).toEqual({});
    expect(result.data[0].availableUntil).toBeNull();
    expect(count).toBe(0);
    expect(prisma.recording.deleteMany).not.toHaveBeenCalled();
  });

  it('attaches an uploaded file to a recording and returns a signed link', async () => {
    prisma.recording.findUnique.mockResolvedValue({ id: 'r1' });
    prisma.upload.findUnique.mockResolvedValue({ filename: 'Folien.pptx', url: '/uploads/uploads/x/f.pptx', mimeType: 'application/vnd.ms-powerpoint', size: 10 });

    const a = await service.addRecordingAttachment('r1', 'up1');

    expect(prisma.recordingAttachment.create.mock.calls[0][0].data).toMatchObject({ recordingId: 'r1', filename: 'Folien.pptx', order: 1 });
    expect(a.url).toMatch(/f\.pptx\?exp=/);
  });

  it('reports a missing recording or upload', async () => {
    prisma.recording.findUnique.mockResolvedValue(null);
    await expect(service.addRecordingAttachment('nope', 'up1')).rejects.toThrow('Recording not found');
  });
});

describe('recording files are removed from disk', () => {
  let dir: string;
  const cwd = process.cwd();
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'rec-'));
    mkdirSync(join(dir, 'uploads', 'uploads', 'x'), { recursive: true });
    writeFileSync(join(dir, 'uploads', 'uploads', 'x', 'slides.pdf'), 'pdf');
    process.chdir(dir);
  });
  afterEach(() => {
    process.chdir(cwd);
    rmSync(dir, { recursive: true, force: true });
  });

  it('deletes the file when its attachment is removed, and never outside the upload folder', async () => {
    const prisma: any = {
      recordingAttachment: {
        findUnique: vi.fn().mockResolvedValueOnce({ id: 'a', url: '/uploads/uploads/x/slides.pdf' }).mockResolvedValueOnce({ id: 'b', url: '/uploads/../outside.txt' }),
        delete: vi.fn(),
      },
    };
    writeFileSync(join(dir, 'outside.txt'), 'keep');
    const service = new EventsService(prisma, { send: vi.fn() } as any);

    await service.deleteRecordingAttachment('a');
    await service.deleteRecordingAttachment('b');

    expect(existsSync(join(dir, 'uploads', 'uploads', 'x', 'slides.pdf'))).toBe(false);
    expect(existsSync(join(dir, 'outside.txt'))).toBe(true);
  });
});
