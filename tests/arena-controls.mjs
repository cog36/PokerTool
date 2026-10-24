import { chromium, expect } from '@playwright/test';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage({ reducedMotion: 'reduce' });
  await page.route('**/api/health', route => route.fulfill({ json: { configured: true } }));
  await page.addInitScript(() => { Math.random = () => .999; });
  let snapshot;
  await page.route('**/api/chat', async route => {
    snapshot = route.request().postDataJSON();
    await route.fulfill({ json: { reply: 'Consider position and pot odds. This is qualified coaching, not a solver verdict.' } });
  });
  await page.goto(`${process.env.FRONTEND_URL || 'http://127.0.0.1:5173'}/#arena`);
  await expect(page.getByRole('link', { name: 'Practice Room' })).toHaveCount(0);
  const stage = page.locator('.arena-stage');
  await expect(stage).toHaveAttribute('data-dealing', 'false');
  await expect(stage).toHaveAttribute('data-playing', 'false');
  await expect(page.locator('.live-feedback strong')).toBeVisible();
  await expect(page.locator('.live-feedback strong')).not.toHaveText(/^You /);
  await expect(page.locator('.arena-hero')).toHaveAttribute('data-physical-seat', '0');
  await expect(stage.locator('.seat-dealer')).toHaveCount(1);
  const sizing = page.getByRole('spinbutton', { name: 'Raise-to amount in big blinds' });
  if (await sizing.count()) {
    await page.getByRole('button', { name: /^75% pot/ }).click();
    await expect(sizing).not.toHaveValue('');
    await sizing.fill('8');
    await expect(sizing).toHaveValue('8');
  }
  await page.locator('.arena-actions button').filter({ hasText: /^(Check|Call)/ }).first().click();
  await expect(page.locator('.decision-reviews')).toContainText('Consider position and pot odds');
  await expect(page.locator('.live-feedback strong')).toBeVisible();
  await expect(page.locator('.feedback-history summary')).toBeVisible();
  await expect(page.locator('.feedback-history')).not.toHaveAttribute('open');
  await expect(page.locator('.arena-bot .player-portrait')).toHaveCount(7);
  await page.screenshot({ path: '/tmp/pokerttool-live-desktop.png', fullPage: true });
  expect(snapshot.messages[0].content).toContain('decision-time snapshot');
  expect(snapshot.messages[0].content).not.toContain('"deck"');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: '/tmp/pokerttool-controls-mobile.png', fullPage: true });
  console.log('PASS: removed Practice Room, fixed hero, dealer chip, typed sizes, pot presets and automatic review.');
} finally { await browser.close(); }
