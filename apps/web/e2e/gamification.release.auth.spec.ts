import { test, expect } from './authenticated.fixture';

// Run against a disposable Square installation at the exact PR revision.
// Pre-provision a synthetic member and server-side issuer; never use a live instance.
// Required: SQUARE_TEST_URL/EMAIL/PASSWORD (Square #102), SQUARE_E2E_API_URL,
// SQUARE_E2E_ADMIN_TOKEN, SQUARE_E2E_ISSUER_TOKEN.
const required = ['SQUARE_TEST_URL','SQUARE_TEST_EMAIL','SQUARE_TEST_PASSWORD',
  'SQUARE_E2E_API_URL','SQUARE_E2E_ADMIN_TOKEN','SQUARE_E2E_ISSUER_TOKEN'] as const;
const ready = required.every(k => Boolean(process.env[k]));
const webUrl = process.env.SQUARE_TEST_URL || 'http://127.0.0.1:4300';
const apiUrl = process.env.SQUARE_E2E_API_URL || 'http://127.0.0.1:4301';
const runId = 'pw-107-' + Date.now();
const adminHeaders = { Authorization: 'Bearer ' + (process.env.SQUARE_E2E_ADMIN_TOKEN || '') };
const issuerHeaders = { Authorization: 'Bearer ' + (process.env.SQUARE_E2E_ISSUER_TOKEN || '') };

test.describe('Square #107 browser sign-in and persistent gamification', () => {
  test('login → trusted reward → purchase/equip → logout/relogin persists', async ({ authenticatedPage: page, request }) => {
    expect(ready, 'Square #102 runtime variables and isolated gamification credentials are required').toBe(true);
    const rewardCode = process.env.SQUARE_E2E_REWARD_CODE || 'playwright-completed';
    const rewardAmount = 20;
    const itemName = runId + '-cosmetic';

    // The Square #102 authenticatedPage fixture completed the real login.
    await expect(page.locator('body')).toBeVisible();

    // Authenticate separately to obtain a short-lived token and authoritative user id
    // for checks; the login above still uses actual browser form/cookies.
    const auth = await request.post(apiUrl + '/api/auth/login', {
      data: {email:process.env.SQUARE_TEST_EMAIL, password:process.env.SQUARE_TEST_PASSWORD},
    });
    expect(auth.ok()).toBeTruthy();
    const session = await auth.json();
    const userId = session.user.id as string;
    const memberHeaders = {Authorization: 'Bearer ' + session.accessToken};

    const rewardDefinition = await request.post(apiUrl + '/api/gamification/admin/rewards', {
      headers: adminHeaders, data:{code:rewardCode,amount:rewardAmount},
    });
    expect(rewardDefinition.ok()).toBeTruthy();
    const itemResponse = await request.post(apiUrl + '/api/gamification/admin/items', {
      headers: adminHeaders, data:{name:itemName,price:7,cosmetic:true},
    });
    expect(itemResponse.ok()).toBeTruthy();
    const itemId = (await itemResponse.json()).id as string;
    const eventKey = runId + ':completed-task-1';
    const eventData = {userId,rewardCode,eventKey};
    const first = await request.post(apiUrl + '/api/gamification/issuer/events', {
      headers:issuerHeaders,data:eventData,
    });
    expect(first.ok()).toBeTruthy();
    expect((await first.json()).duplicate).toBe(false);
    const retry = await request.post(apiUrl + '/api/gamification/issuer/events', {
      headers:issuerHeaders,data:eventData,
    });
    expect(retry.ok()).toBeTruthy();
    expect((await retry.json()).duplicate).toBe(true);

    const purchase = await request.post(apiUrl + '/api/gamification/purchase', {
      headers:memberHeaders,data:{itemId,requestKey:runId + ':purchase'},
    });
    expect(purchase.ok()).toBeTruthy();
    expect((await purchase.json()).duplicate).toBe(false);
    const equip = await request.post(apiUrl + '/api/gamification/equipment', {
      headers:memberHeaders,data:{slot:'vehicle',itemId,variant:'blue'},
    });
    expect(equip.ok()).toBeTruthy();
    const before = await request.get(apiUrl + '/api/gamification/wallet',{headers:memberHeaders});
    expect((await before.json()).balance).toBeGreaterThanOrEqual(rewardAmount - 7);

    // End the API refresh session and clear the browser's local auth state
    // before exercising a new UI login.
    const logout = await request.post(apiUrl + '/api/auth/logout', {
      data: {refreshToken: session.refreshToken},
    });
    expect(logout.ok()).toBeTruthy();
    await page.evaluate(() => {localStorage.clear(); sessionStorage.clear();});
    await page.context().clearCookies();
    await page.goto(new URL('/login',webUrl).toString());
    await page.locator('#email').fill(process.env.SQUARE_TEST_EMAIL!);
    await page.locator('#password').fill(process.env.SQUARE_TEST_PASSWORD!);
    await page.locator('button[type="submit"]').click();
    await expect(page).not.toHaveURL(/\/login(?:\?|$)/);
    const secondAuth = await request.post(apiUrl + '/api/auth/login', {
      data:{email:process.env.SQUARE_TEST_EMAIL,password:process.env.SQUARE_TEST_PASSWORD},
    });
    expect(secondAuth.ok()).toBeTruthy();
    const freshHeaders = {Authorization: 'Bearer ' + (await secondAuth.json()).accessToken};
    const inventory = await request.get(apiUrl + '/api/gamification/inventory',{headers:freshHeaders});
    expect(inventory.ok()).toBeTruthy();
    expect((await inventory.json()).some((entry: {itemId:string})=>entry.itemId===itemId)).toBe(true);
    const equipment = await request.get(apiUrl + '/api/gamification/equipment',{headers:freshHeaders});
    expect(equipment.ok()).toBeTruthy();
    expect((await equipment.json()).some((entry: {itemId:string;slot:string;variant:string})=>
      entry.itemId===itemId && entry.slot==='vehicle' && entry.variant==='blue')).toBe(true);
  });
});
