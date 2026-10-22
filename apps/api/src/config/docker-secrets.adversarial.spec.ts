/**
 * ADVERSARIAL TESTS: Docker Compose secrets configuration
 *
 * Verifies that docker-compose.yml does not contain predictable default
 * secrets or expose credentials via environment variables.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const composeFile = readFileSync(
  join(__dirname, '..', '..', '..', '..', 'docker-compose.yml'),
  'utf-8',
);

describe('Docker Compose — secrets hardening', () => {
  describe('FIXED SEC-024: no predictable default JWT secrets', () => {
    it('JWT_SECRET does not use a default fallback value', () => {
      expect(composeFile).not.toContain('change-me-in-production');
    });

    it('JWT_REFRESH_SECRET does not use a default fallback value', () => {
      expect(composeFile).not.toContain('change-me-refresh-in-production');
    });

    it('JWT secrets use fail-fast syntax (:?) instead of defaults (:-)', () => {
      expect(composeFile).toContain('JWT_SECRET: ${JWT_SECRET:?');
      expect(composeFile).toContain('JWT_REFRESH_SECRET: ${JWT_REFRESH_SECRET:?');
    });
  });

  describe('FIXED SEC-030: backup service does not expose PGPASSWORD', () => {
    it('backup service does not set PGPASSWORD environment variable', () => {
      // Extract the backup service section
      const backupSection = composeFile.split('backup:')[1] ?? '';
      expect(backupSection).not.toContain('PGPASSWORD:');
    });

    it('backup service uses .pgpass file approach', () => {
      expect(composeFile).toContain('.pgpass');
      expect(composeFile).toContain('chmod 600');
    });
  });
});
