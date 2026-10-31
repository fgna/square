import { test, expect } from '@playwright/test';

// Run against a disposable Square installation at the exact PR revision.
// Pre-provision a synthetic member and server-side issuer; never use a live instance.
// Required: SQUARE_E2E_WEB_URL, SQUARE_E2E_API_URL, SQUARE_E2E_EMAIL,
// SQUARE_E2E_PASSWORD, SQUARE_E2E_ADMIN_TOKEN, SQUARE_E2E_ISSUER_TOKEN.
const required = ['SQUARE_E2E_WEB_URL','SQUARE_E2E_API_URL','SQUARE_E2E_EMAIL',
  'SQUARE_E2E_PASSWORD','SQUARE_E2E_ADMIN_TOKEN','SQUARE_E2E_ISSUER_TOKEN'] as const;
const ready = required.every(k => Boolean(process.env[k]));
const webUrl = process.env.SQUARE_E2E_WEB_URL || 'http://127.0.0.1:4300';
const apiUrl = process.env.SQUARE_E2E_API_URL || 'http://127.0.0.1:4301';
const runId = 'pw-107-' + Date.now();
const adminHeaders = { Authorization: 'Bearer ' + (process.env.SQUARE_E2E_ADMIN_TOKEN || '') };
const issuerHeaders = { Authorization: 'Bearer ' + (process.env.SQUARE_E2E_ISSUER_TOKEN || '') };

test.describe('Square #107 browser sign-in and persistent gamification', () => {
  test.skip(!ready, 'Requires an explicitly configured disposable test instance');

  test('login → trusted reward → purchase/equip → logout/relogin persists', async ({ page, request }) => {
    const rewardCode = process.env.SQUARE_E2E_REWARD_CODE || 'playwright-completed';
    const rewardAmount = 20;
    const itemName = runId + '-cosmetic';

    // Exercise real browser sign-in, not a mocked token or user state.
    await page.goto(new URL('/login', webUrl).toString());
    await page.locator('#email').fill(process.env.SQUARE_E2E_EMAIL!);
    await page.locator('#password').fill(process.env.SQUARE_E2E_PASSWORD!);
    await page.locator('button[type="submit"]').click();
    await expect(page).not.toHaveURL(/\/login(?:\?|$)/);

    // Authenticate separately to obtain a short-lived token and authoritative user id
    // for checks; the login above still uses actual browser form/cookies.
    const auth = await request.post(apiUrl + '/api/auth/login', {
      data: {email:process.env.SQUARE_E2E_EMAIL, password:process.env.SQUARE_E2E_PASSWORD},
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

    // Invalidate the browser's login state via its actual auth UI/session,
    // then verify a fresh sign-in and API data persistence.
    await page.context().clearCookies();
    await page.goto(new URL('/login',webUrl).toString());
    await page.locator('#email').fill(process.env.SQUARE_E2E_EMAIL!);
    await page.locator('#password').fill(process.env.SQUARE_E2E_PASSWORD!);
    await page.locator('button[type="submit"]').click();
    await expect(page).not.toHaveURL(/\/login(?:\?|$)/);
    const secondAuth = await request.post(apiUrl + '/api/auth/login', {
      data:{email:process.env.SQUARE_E2E_EMAIL,password:process.env.SQUARE_E2E_PASSWORD},
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
