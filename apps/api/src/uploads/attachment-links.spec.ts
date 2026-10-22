import { describe, it, expect, vi } from 'vitest';
import { signUploadPath, verifyUploadPath, protectLessonAttachments } from './attachment-links';

const path = '/uploads/uploads/u1/abc-worksheet.pdf';

function parse(signed: string) {
  const url = new URL(signed, 'http://x');
  return { exp: url.searchParams.get('exp'), sig: url.searchParams.get('sig') };
}

describe('signed upload links', () => {
  it('accepts its own signature until it expires', () => {
    const now = Date.UTC(2026, 8, 24);
    const { exp, sig } = parse(signUploadPath(path, now));
    expect(verifyUploadPath(path, exp, sig, now)).toBe(true);
    expect(verifyUploadPath(path, exp, sig, now + 25 * 60 * 60 * 1000)).toBe(false);
  });

  it('refuses a signature for another file', () => {
    const { exp, sig } = parse(signUploadPath(path));
    expect(verifyUploadPath('/uploads/uploads/u1/other.pdf', exp, sig)).toBe(false);
  });

  it('refuses missing or forged parameters', () => {
    expect(verifyUploadPath(path, undefined, undefined)).toBe(false);
    expect(verifyUploadPath(path, '9999999999', 'f'.repeat(64))).toBe(false);
  });
});

describe('protectLessonAttachments', () => {
  function run(isAttachment: boolean, query: Record<string, string>, file = path, isRecordingAttachment = false) {
    const prisma = {
      lessonAttachment: { findFirst: vi.fn().mockResolvedValue(isAttachment ? { id: 'a' } : null) },
      recordingAttachment: { findFirst: vi.fn().mockResolvedValue(isRecordingAttachment ? { id: 'r' } : null) },
    };
    const next = vi.fn();
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn(), end: vi.fn() };
    const req = { path: file.replace('/uploads', ''), query };
    return protectLessonAttachments(prisma as any)(req as any, res as any, next).then(() => ({ next, res }));
  }

  it('lets other uploads (avatars, logos) through without a signature', async () => {
    const { next } = await run(false, {}, '/uploads/avatars/u1.png');
    expect(next).toHaveBeenCalled();
  });

  it('serves a document without an attachment record when the signature is valid', async () => {
    const file = '/uploads/uploads/x/handout.pdf';
    const { next } = await run(false, parse(signUploadPath(file)) as Record<string, string>, file);
    expect(next).toHaveBeenCalled();
  });

  it('blocks documents and audio without a signature even when no attachment points to them any more', async () => {
    for (const file of ['/uploads/uploads/x/slides.pptx', '/uploads/uploads/x/handout.PDF', '/uploads/uploads/x/talk.mp3']) {
      const { next, res } = await run(false, {}, file);
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
    }
  });

  it('blocks a recording attachment without a signature and serves it with one', async () => {
    const file = '/uploads/uploads/x/notes.key';
    expect((await run(false, {}, file, true)).next).not.toHaveBeenCalled();
    expect((await run(false, parse(signUploadPath(file)) as Record<string, string>, file, true)).next).toHaveBeenCalled();
  });

  it('blocks a lesson attachment without a signature', async () => {
    const { next, res } = await run(true, {});
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('serves a lesson attachment with a valid signature', async () => {
    const { next } = await run(true, parse(signUploadPath(path)) as Record<string, string>);
    expect(next).toHaveBeenCalled();
  });
});
