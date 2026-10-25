import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';

const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:4173/');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) await new Promise(resolve => navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true }));
  });
  const manifest = await page.evaluate(async () => (await fetch(document.querySelector('link[rel="manifest"]').href)).json());
  assert.equal(manifest.display, 'standalone');
  for (const icon of manifest.icons) {
    const response = await page.request.get(`http://127.0.0.1:4173/${icon.src}`);
    assert.equal(response.status(), 200);
    assert.equal(response.headers()['content-type'], 'image/png');
  }
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'AI Arena', exact: true }).click();
  assert.equal(await page.getByRole('button', { name: 'Menu', exact: true }).getAttribute('aria-expanded'), 'false');
  await page.locator('#arena').waitFor({ state: 'visible' });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'phone page must not overflow horizontally');
  await page.screenshot({ path: '/tmp/pokertool-phone.png', fullPage: true });
  await context.setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.locator('#arena').waitFor({ state: 'visible' });
  await page.getByText('Offline · Arena', { exact: false }).waitFor();
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await page.getByRole('navigation').getByRole('link', { name: 'Preflop Charts', exact: true }).click();
  await page.locator('#ranges').waitFor({ state: 'visible' });
  const cachedApi = await page.evaluate(async () => {
    const names = await caches.keys();
    const requests = (await Promise.all(names.filter(name => name.startsWith('pokertool-shell-')).map(async name => (await caches.open(name)).keys()))).flat();
    return requests.some(request => new URL(request.url).pathname.startsWith('/api'));
  });
  assert.equal(cachedApi, false);
  assert.deepEqual(errors, []);
  await context.close();
  const desktop = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await desktop.goto('http://127.0.0.1:4173/');
  assert.ok(await desktop.getByRole('navigation').isVisible());
  assert.ok(!await desktop.getByRole('button', { name: 'Menu', exact: true }).isVisible());
  console.log('Phone navigation, production worker, offline Arena/charts, manifest/icons and desktop navigation passed.');
} finally {
  await browser.close();
}
