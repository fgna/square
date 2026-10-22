import { createHmac, timingSafeEqual } from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import type { PrismaService } from '../prisma/prisma.service';

// Course downloads used to be public: anyone with the link could fetch them.
// Links, iframes and audio players cannot send the bearer token, so the API
// hands signed members a link with an expiry and a signature instead, and the
// static file route refuses lesson attachments without a valid one. Avatars,
// logos and cover images stay public.
//
// Recording attachments are protected the same way. Documents and audio are
// protected by their type as well: a file whose lesson or recording
// attachment was deleted still sits on disk and used to become public then.
const PROTECTED_EXTENSIONS = /\.(pdf|docx?|xlsx?|pptx?|mp3|m4a|wav)$/i;

const LINK_TTL_SECONDS = 24 * 60 * 60;

function secret(): string {
  return process.env.UPLOAD_LINK_SECRET || process.env.JWT_SECRET || 'default-secret';
}

function signature(path: string, exp: number): string {
  return createHmac('sha256', secret()).update(`${path}:${exp}`).digest('hex');
}

/** Adds an expiry and a signature to a stored upload path such as /uploads/… */
export function signUploadPath(path: string, now = Date.now()): string {
  if (!path.startsWith('/uploads/')) return path;
  const exp = Math.floor(now / 1000) + LINK_TTL_SECONDS;
  return `${path}?exp=${exp}&sig=${signature(path, exp)}`;
}

export function verifyUploadPath(path: string, exp: unknown, sig: unknown, now = Date.now()): boolean {
  if (typeof exp !== 'string' || typeof sig !== 'string') return false;
  const expires = Number(exp);
  if (!Number.isInteger(expires) || expires < Math.floor(now / 1000)) return false;
  const expected = Buffer.from(signature(path, expires));
  const given = Buffer.from(sig);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

/** Express middleware for the /uploads static route. */
export function protectLessonAttachments(prisma: PrismaService) {
  return async (req: Request, res: Response, next: NextFunction) => {
    let path: string;
    try {
      path = `/uploads${decodeURIComponent(req.path)}`;
    } catch {
      return res.status(400).end();
    }
    if (verifyUploadPath(path, req.query.exp, req.query.sig)) return next();
    const isProtected =
      PROTECTED_EXTENSIONS.test(path) ||
      (await prisma.lessonAttachment.findFirst({ where: { url: path }, select: { id: true } })) ||
      (await prisma.recordingAttachment.findFirst({ where: { url: path }, select: { id: true } }));
    if (!isProtected) return next();
    return res.status(403).json({ message: 'This file is only available to signed-in members.' });
  };
}
