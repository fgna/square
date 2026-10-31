import { test, expect } from '@playwright/test';

// Point at a separate, isolated instance with both capabilities allowlists
// explicitly excluding gamification. This never changes running configuration.
const base = process.env.SQUARE_E2E_DISABLED_API_URL;
test.describe('Square #107 disabled capability', () => {
  test.skip(!base, 'Set SQUARE_E2E_DISABLED_API_URL to a disposable capability-off API');
  test('all public, member, admin and issuer routes remain unavailable', async ({request}) => {
    for (const [method,path] of [
      ['GET','wallet'],['GET','items'],['GET','inventory'],
      ['GET','transactions'],['GET','equipment'],
      ['POST','purchase'],['POST','equipment'],
      ['POST','issuer/events'],['POST','admin/rewards'],
      ['POST','admin/events'],['POST','admin/items'],
    ]) {
      const response = await request.fetch(base + '/api/gamification/' + path, {
        method, data: method==='POST' ? {} : undefined,
      });
      expect(response.status(), method+' '+path).toBe(404);
    }
  });
});
