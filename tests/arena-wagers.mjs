// Browser regression for displayed bet amounts and per-hand seat/roster changes.
// Requires `npm run dev`; no AI provider or backend request is needed.
import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';

const base = process.env.FRONTEND_URL || 'http://127.0.0.1:5173';
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1050 } });
  await page.addInitScript(() => { Math.random = () => .999; });
  await page.route('**/api/health', route => route.fulfill({ json: { status: 'ok', configured: false } }));
  await page.goto(`${base}/#arena`);
  await page.getByRole('button', { name: 'Cinematic play', exact: true }).click();
  async function ready() {
    await expect(page.locator('.skip-playback')).toHaveCount(0, { timeout: 20000 });
    await expect(page.locator('.arena-stage')).toHaveAttribute('data-dealing', 'false');
    await expect(page.locator('.arena-stage')).toHaveAttribute('data-playing', 'false');
  }
  await ready();
  const firstSeat = await page.locator('.arena-hero').getAttribute('data-physical-seat');
  const firstPosition = await page.locator('.decision-context > span').first().locator('strong').textContent();
  const roster = (await page.locator('.archetype-tag').allTextContents()).sort();
  await page.getByRole('spinbutton', { name: 'Raise-to amount in big blinds' }).fill('3');
  await page.getByRole('button', { name: 'Quick play', exact: true }).click();
  await page.getByRole('button', { name: 'Raise to 3 bb', exact: true }).click();
  const wager = page.locator('.seat-wager[data-player="0"]');
  await expect(wager.locator('.wager-action')).toHaveText('Raise to 3bb');
  await expect(wager.locator('.wager-pile')).toHaveText('3bb');
  await expect(wager.locator('.chip-pile')).toBeVisible();
  await page.screenshot({ path: '/tmp/pokerttool-wager-3bb.png', fullPage: true, animations: 'disabled' });

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await ready();
  let turns = 0;
  while (!await page.locator('.arena-outcome').count()) {
    assert.ok(++turns < 100);
    await page.locator('.arena-actions').getByRole('button', { name: /^(Check|Call )/ }).click();
    await ready();
  }
  await expect(page.locator('.wager-pile')).toHaveCount(0);
  await page.getByRole('button', { name: 'Deal next hand', exact: false }).click();
  await ready();
  assert.equal(await page.locator('.arena-hero').getAttribute('data-physical-seat'), '0');
  assert.notEqual(await page.locator('.decision-context > span').first().locator('strong').textContent(), firstPosition);
  assert.notDeepEqual((await page.locator('.archetype-tag').allTextContents()).sort(), roster);
  await page.setViewportSize({ width: 390, height: 1000 });
  const readable = await page.locator('.arena-stage').evaluate(stage => {
    const bounds = stage.getBoundingClientRect();
    return [...stage.querySelectorAll('.wager-pile, .arena-hero .card')].every(element => {
      const box = element.getBoundingClientRect();
      return box.left >= bounds.left - 1 && box.right <= bounds.right + 1 && box.top >= bounds.top - 1 && box.bottom <= bounds.bottom + 1;
    });
  });
  assert.ok(readable, 'The reseated hero and wager amounts fit the mobile table');
  await page.screenshot({ path: '/tmp/pokerttool-reseated-mobile.png', fullPage: true, animations: 'disabled' });
  console.log('PASS: visible 3bb raise and chips, street collection, new archetypes, moved hero and poker position, and mobile bounds.');
} finally {
  await browser.close();
}
