import { test, expect } from './authenticated.fixture';

// Point at a separate, isolated instance with both capabilities allowlists
// explicitly excluding gamification. This never changes running configuration.
const base = process.env.SQUARE_E2E_DISABLED_API_URL;
test.describe('Square #107 disabled capability', () => {
  
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
