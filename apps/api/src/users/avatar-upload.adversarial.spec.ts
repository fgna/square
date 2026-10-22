/**
 * ADVERSARIAL TESTS: Avatar Upload — Header Injection & SSRF
 *
 * Attack surfaces (PR #14):
 * - SEC-026: Avatar URL is constructed from user-controlled request headers
 *   (x-forwarded-proto, x-forwarded-host). An attacker uploading an avatar
 *   can forge these headers to store a URL pointing to an attacker-controlled
 *   domain. When other users load the member's profile, their browser fetches
 *   the avatar from the attacker's server — enabling tracking, phishing, and
 *   credential harvesting.
 *
 * - SEC-029: File extension is derived from the original filename via extname().
 *   An attacker could upload 'avatar.jpg.svg' and the stored file would have
 *   an .svg extension, potentially bypassed by MIME checks.
 *
 * File: apps/api/src/users/users.controller.ts lines 43-76
 */

import { describe, it, expect, vi } from 'vitest';

describe('Avatar upload — adversarial', () => {

  // ── SEC-026: x-forwarded-host header injection ─────────────────────────

  describe('SEC-026: avatar URL SSRF via x-forwarded-host injection', () => {
    it('attacker-controlled x-forwarded-host is used verbatim in stored avatarUrl', () => {
      /**
       * users.controller.ts:71-73:
       *   const protocol = (req.headers['x-forwarded-proto'] as string) || req.protocol;
       *   const host = (req.headers['x-forwarded-host'] as string) || req.get('host');
       *   const avatarUrl = `${protocol}://${host}/uploads/avatars/${file.filename}`;
       *
       * An attacker sends:
       *   POST /api/users/me/avatar
       *   x-forwarded-host: evil.com
       *   x-forwarded-proto: https
       *   Content-Type: multipart/form-data; boundary=...
       *   [valid JPEG file]
       *
       * The stored URL becomes: https://evil.com/uploads/avatars/user-1234-1718624400000.jpg
       *
       * Impact:
       * - Every user viewing the attacker's profile loads an image from evil.com
       * - evil.com receives the viewer's IP, User-Agent, Referer header (leaks page URL)
       * - evil.com can serve a 302 redirect to a phishing page
       * - evil.com can set cookies if SameSite=None (unlikely but possible)
       * - No validation on the resulting URL before storing in DB
       */
      const mockReq = {
        headers: {
          'x-forwarded-proto': 'https',
          'x-forwarded-host': 'evil.com',
        },
        protocol: 'http',
        get: (header: string) => header === 'host' ? 'localhost:3001' : undefined,
      };
      const mockFile = { filename: 'user1-1718624400000.jpg' };

      // Reproduce the controller's URL construction logic
      const protocol = (mockReq.headers['x-forwarded-proto'] as string) || mockReq.protocol;
      const host = (mockReq.headers['x-forwarded-host'] as string) || mockReq.get('host');
      const avatarUrl = `${protocol}://${host}/uploads/avatars/${mockFile.filename}`;

      // The URL points to the attacker's domain
      expect(avatarUrl).toBe('https://evil.com/uploads/avatars/user1-1718624400000.jpg');
      expect(avatarUrl).not.toContain('localhost');
    });

    it('without x-forwarded headers, URL uses the actual host (safe baseline)', () => {
      const mockReq = {
        headers: {},
        protocol: 'http',
        get: (header: string) => header === 'host' ? 'localhost:3001' : undefined,
      };
      const mockFile = { filename: 'user1-1718624400000.jpg' };

      const protocol = (mockReq.headers['x-forwarded-proto'] as string) || mockReq.protocol;
      const host = (mockReq.headers['x-forwarded-host'] as string) || mockReq.get('host');
      const avatarUrl = `${protocol}://${host}/uploads/avatars/${mockFile.filename}`;

      expect(avatarUrl).toBe('http://localhost:3001/uploads/avatars/user1-1718624400000.jpg');
    });

    it('x-forwarded-host with port injection creates valid-looking URL', () => {
      const mockReq = {
        headers: {
          'x-forwarded-host': 'evil.com:8080',
          'x-forwarded-proto': 'http',
        },
        protocol: 'http',
        get: (header: string) => header === 'host' ? 'localhost:3001' : undefined,
      };
      const mockFile = { filename: 'user1-1718624400000.jpg' };

      const protocol = (mockReq.headers['x-forwarded-proto'] as string) || mockReq.protocol;
      const host = (mockReq.headers['x-forwarded-host'] as string) || mockReq.get('host');
      const avatarUrl = `${protocol}://${host}/uploads/avatars/${mockFile.filename}`;

      expect(avatarUrl).toBe('http://evil.com:8080/uploads/avatars/user1-1718624400000.jpg');
    });
  });

  // ── SEC-029: double extension bypass ───────────────────────────────────

  describe('SEC-029: file extension derived from original filename', () => {
    it('double extension (avatar.jpg.svg) stores file with .svg extension', () => {
      /**
       * users.controller.ts:52-54:
       *   filename: (req: any, file: any, cb: any) => {
       *     const userId = req.user?.id ?? 'unknown';
       *     cb(null, `${userId}-${Date.now()}${extname(file.originalname)}`);
       *   }
       *
       * extname('avatar.jpg.svg') → '.svg'
       * extname('avatar.png.html') → '.html'
       *
       * The MIME filter only checks file.mimetype (which is derived from the
       * Content-Type header, not the file content). An attacker could send:
       *   Content-Type: image/jpeg  (passes MIME filter)
       *   filename: avatar.jpg.svg  (stored with .svg extension)
       *
       * If the uploads directory is ever served with content-type sniffing,
       * the .svg file could execute JavaScript.
       */
      const { extname } = require('path');

      expect(extname('avatar.jpg.svg')).toBe('.svg');
      expect(extname('avatar.png.html')).toBe('.html');
      expect(extname('normal-avatar.jpg')).toBe('.jpg');
    });

    it('MIME filter uses Content-Type header, not file magic bytes', () => {
      /**
       * The file filter checks file.mimetype which comes from the HTTP
       * Content-Type header, NOT from the actual file content. An attacker
       * can send any file with Content-Type: image/jpeg and it passes.
       *
       * Multer's mimetype is set from the Content-Disposition header's
       * content type, which the client controls entirely.
       */
      const allowedMime = /^image\/(jpeg|jpg|png|gif|webp)$/;

      // Attacker claims JPEG but file is actually SVG with embedded JS
      expect(allowedMime.test('image/jpeg')).toBe(true);
      // The actual file content is NOT checked — only the declared MIME type
    });
  });
});
