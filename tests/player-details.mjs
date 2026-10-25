import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:5189/#arena');
  const picker = page.getByRole('combobox', { name: 'Inspect a player' });
  await picker.waitFor();
  await picker.selectOption('1');
  const panel = page.getByRole('dialog', { name: /.+/ });
  await panel.waitFor();
  await panel.getByText('Stack remaining', { exact: true }).waitFor();
  await panel.getByText('Live public information only.', { exact: false }).waitFor();
  assert.equal(await panel.locator('.card, .hidden-card').count(), 0, 'inspection must never reveal private cards');
  assert.ok(await panel.evaluate(node => node.getBoundingClientRect().right <= innerWidth));
  await page.screenshot({ path: '/tmp/pokertool-player-details.png' });
  await panel.getByRole('button', { name: 'Close', exact: true }).click();
  await panel.waitFor({ state: 'detached' });
  const seat = page.locator('#arena .arena-bot').first();
  await seat.focus();
  await page.keyboard.press('Enter');
  await panel.waitFor();
  await page.keyboard.press('Escape');
  await panel.waitFor({ state: 'detached' });
  for (const width of [360, 390, 430]) {
    await page.setViewportSize({ width, height: 844 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `overflow at ${width}`);
  }
  assert.deepEqual(errors, []);
  console.log('Phone player picker, seat keyboard activation, public-only details, close/Escape and small-screen bounds passed.');
} finally { await browser.close(); }
