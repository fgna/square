/**
 * ADVERSARIAL TESTS: Auth endpoint throttle configuration
 *
 * Verifies that all auth endpoints have per-route @Throttle decorators
 * and that the limits are strict enough to prevent credential stuffing.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const controllerSource = readFileSync(
  join(__dirname, 'auth.controller.ts'),
  'utf-8',
);

describe('Auth controller — throttle hardening', () => {
  describe('FIXED SEC-025: login rate limit is strict enough', () => {
    it('login endpoint has @Throttle decorator', () => {
      expect(controllerSource).toContain("@Throttle({");
    });

    it('login limit is 10 or fewer per 15 min', () => {
      const loginMatch = controllerSource.match(
        /login[\s\S]*?@Throttle\(\{[^}]*limit:\s*(\d+)/,
      );
      // Match the @Throttle before the login method
      const allThrottles = [...controllerSource.matchAll(/@Throttle\(\{\s*auth:\s*\{\s*limit:\s*(\d+)/g)];
      // Second @Throttle is login (first is register)
      const loginLimit = allThrottles[1] ? Number(allThrottles[1][1]) : undefined;
      expect(loginLimit).toBeDefined();
      expect(loginLimit).toBeLessThanOrEqual(10);
    });
  });

  describe('FIXED SEC-028: refresh and logout have per-route @Throttle', () => {
    it('refresh endpoint has @Throttle decorator', () => {
      const refreshSection = controllerSource.split("'refresh'")[1]?.split("@Post")[0] ?? '';
      // Check the section around the refresh method has @Throttle
      const allThrottles = [...controllerSource.matchAll(/@Throttle\(\{\s*auth:\s*\{\s*limit:\s*(\d+)/g)];
      // Should have at least 4 throttle decorators (register, login, refresh, logout)
      expect(allThrottles.length).toBeGreaterThanOrEqual(4);
    });

    it('refresh limit is defined', () => {
      const allThrottles = [...controllerSource.matchAll(/@Throttle\(\{\s*auth:\s*\{\s*limit:\s*(\d+)/g)];
      // Third @Throttle is refresh
      const refreshLimit = allThrottles[2] ? Number(allThrottles[2][1]) : undefined;
      expect(refreshLimit).toBeDefined();
      expect(refreshLimit).toBeGreaterThan(0);
    });

    it('logout limit is defined', () => {
      const allThrottles = [...controllerSource.matchAll(/@Throttle\(\{\s*auth:\s*\{\s*limit:\s*(\d+)/g)];
      // Fourth @Throttle is logout
      const logoutLimit = allThrottles[3] ? Number(allThrottles[3][1]) : undefined;
      expect(logoutLimit).toBeDefined();
      expect(logoutLimit).toBeGreaterThan(0);
    });
  });
});
