/**
 * ADVERSARIAL TESTS: Uploads & S3 Storage
 *
 * SEC-033: S3Service local-disk mode path traversal via crafted key
 * SEC-034: MIME type validation uses client-supplied Content-Type, not magic bytes
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';

// ── SEC-033: path traversal in local disk mode ────────────────────────────────

describe('[SEC-033] S3Service local-disk path traversal', () => {
  it('path.join does not prevent ../ traversal in the key', () => {
    const localDir = '/app/uploads';
    const maliciousKey = 'uploads/../../etc/cron.d/pwned';

    const resolved = path.join(localDir, maliciousKey);

    // SEC-033: path.join resolves the ".." segments — the file lands outside localDir
    // A safe implementation would reject keys whose resolved path escapes localDir
    expect(resolved.startsWith(localDir)).toBe(false);
  });

  it('even deeper traversal escapes to root', () => {
    const localDir = '/app/uploads';
    const key = '../../../tmp/evil';

    const resolved = path.join(localDir, key);
    expect(resolved).toBe('/tmp/evil');
  });

  it('safe implementation would normalize and check prefix', () => {
    const localDir = '/app/uploads';
    const key = 'uploads/../../etc/passwd';

    const resolved = path.resolve(localDir, key);
    const normalized = path.normalize(resolved);

    // Demonstrate what a fix would check:
    const isSafe = normalized.startsWith(localDir + path.sep) || normalized === localDir;
    expect(isSafe).toBe(false);
  });
});

// ── SEC-034: MIME type from Content-Type header ───────────────────────────────

describe('[SEC-034] MIME type validation bypass', () => {
  it('IMAGE_TYPES check trusts client-supplied mimetype', () => {
    const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

    // An attacker sets Content-Type: image/jpeg but sends an EXE payload
    const fakeFile = {
      mimetype: 'image/jpeg',
      size: 1024,
      originalname: 'payload.exe',
      buffer: Buffer.from('MZ\x90\x00'), // PE executable magic bytes
    };

    const passesCheck = IMAGE_TYPES.includes(fakeFile.mimetype);

    // SEC-034: the check passes because it only looks at the header, not the actual bytes
    expect(passesCheck).toBe(true);
  });

  it('FILE_TYPES check similarly trusts client-supplied mimetype', () => {
    const FILE_TYPES = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
    ];

    const fakeFile = {
      mimetype: 'application/pdf',
      size: 1024,
      originalname: 'report.pdf',
      buffer: Buffer.from('<script>alert("xss")</script>'),
    };

    expect(FILE_TYPES.includes(fakeFile.mimetype)).toBe(true);
  });

  it('sanitized filename still preserves dangerous extensions', () => {
    const originalname = 'payload.exe';
    const sanitized = originalname.replace(/[^a-zA-Z0-9._-]/g, '_');

    // .exe extension survives sanitization
    expect(sanitized).toBe('payload.exe');
    expect(sanitized.endsWith('.exe')).toBe(true);
  });

  it('double extension attack survives sanitization', () => {
    const originalname = 'innocent.pdf.exe';
    const sanitized = originalname.replace(/[^a-zA-Z0-9._-]/g, '_');

    expect(sanitized).toBe('innocent.pdf.exe');
    expect(sanitized.endsWith('.exe')).toBe(true);
  });
});
