import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';

const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto('http://127.0.0.1:4173/');
  assert.equal(await page.getByRole('button', { name: 'Share QR', exact: true }).count(), 0);
  await page.goto('http://127.0.0.1:4173/share.html');
  const dialog = page.getByRole('region', { name: 'Scan to play.' });
  await dialog.getByText('This is a computer-only address.', { exact: false }).waitFor();
  assert.equal(await dialog.locator('img').count(), 0);
  const address = dialog.getByRole('textbox', { name: 'Website or demo address' });
  assert.equal(await address.inputValue(), 'http://127.0.0.1:4173/');
  await address.fill('javascript:alert(1)');
  assert.equal(await dialog.locator('img').count(), 0);
  await address.fill('https://pokertool.example/demo/');
  await dialog.getByRole('img').waitFor();
  assert.match(await dialog.getByRole('img').getAttribute('src'), /^data:image\/png;base64,/);
  assert.equal(await dialog.getByRole('link', { name: 'Download QR' }).getAttribute('download'), 'PokerTool-QR.png');
  assert.ok(await dialog.evaluate(node => node.getBoundingClientRect().right <= innerWidth));
  await page.screenshot({ path: '/tmp/pokertool-share-qr.png' });
  assert.equal(await page.locator('.sidebar').count(), 0);
  assert.ok(await page.getByRole('link', { name: 'PokerTool', exact: false }).isVisible());
  if (process.env.QR_DEV_URL) {
    await page.goto(`${process.env.QR_DEV_URL}/share.html`);
    await page.getByRole('img').waitFor();
    const detected = await page.getByRole('textbox', { name: 'Website or demo address' }).inputValue();
    assert.ok(!detected.includes('127.0.0.1') && !detected.includes('localhost'));
    assert.equal(new URL(detected).port, new URL(process.env.QR_DEV_URL).port);
    console.log('Automatic Wi-Fi detection and QR generation passed.');
  }
  console.log('Share QR: localhost guidance, URL validation, local PNG generation, download and standalone mobile page passed.');
} finally { await browser.close(); }
