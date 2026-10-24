// Run against `npm run dev` with: npm run test:browser
// Uses installed Google Chrome; set PLAYWRIGHT_CHANNEL for another browser channel.
import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';

const baseUrl = process.env.FRONTEND_URL || 'http://127.0.0.1:5173';
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(baseUrl);
  await page.getByRole('heading', { name: 'Welcome to the table.' }).waitFor();
  const originalTheme = await page.locator('html').getAttribute('data-theme');
  await page.getByRole('button', { name: /Switch to .* mode/ }).click();
  const selectedTheme = await page.locator('html').getAttribute('data-theme');
  assert.notEqual(selectedTheme, originalTheme);
  await page.reload();
  assert.equal(await page.locator('html').getAttribute('data-theme'), selectedTheme);

  await page.getByRole('navigation').getByRole('link', { name: 'Range Explorer', exact: false }).first().click();
  assert.equal(await page.locator('.hand').count(), 169);
  await page.getByRole('button', { name: 'UTG', exact: true }).click();
  await page.getByRole('button', { name: /^77, illustrative/ }).click();
  assert.equal(await page.locator('.inspector h2').textContent(), '77');
  await page.getByRole('searchbox').fill('AKs');
  assert.equal(await page.locator('.hand:not(.dimmed)').count(), 1);

  await page.getByRole('navigation').getByRole('link', { name: 'Practice Room', exact: false }).click();
  await page.getByRole('heading', { name: 'A strong start', exact: true }).click();
  await page.keyboard.press('3');
  await expect(page.locator('.practice-metrics strong').first()).toHaveText('100');
  await page.keyboard.press('3');
  await expect(page.locator('.practice-metrics strong').first()).toHaveText('100');
  await page.getByRole('button', { name: 'Next decision' }).click();
  await page.getByRole('button', { name: '1 Fold' }).click();
  await expect(page.locator('.practice-metrics strong').first()).toHaveText('200');
  await page.getByRole('navigation').getByRole('link', { name: 'Overview', exact: false }).first().click();
  assert.equal(await page.locator('#overview-attempts').textContent(), '2');
  await page.getByRole('checkbox').first().check();
  await page.getByRole('navigation').getByRole('link', { name: 'Practice Room' }).click();
  await page.getByRole('button', { name: 'Next decision' }).click();
  await page.getByRole('button', { name: '1 Fold' }).click();
  await expect(page.locator('.answer-indicator.incorrect')).toHaveText(/Incorrect/);
  await expect(page.locator('.action-buttons .chosen')).toHaveClass(/incorrect/);
  assert.equal(await page.locator('.action-buttons .chosen').evaluate(element => getComputedStyle(element).backgroundColor), 'rgb(220, 53, 73)');
  await page.getByRole('button', { name: 'Repeat the examples' }).click();
  await expect(page.locator('.answer-indicator')).toHaveCount(0);


  await page.getByRole('navigation').getByRole('link', { name: 'Hand Library', exact: false }).click();
  await page.getByRole('button', { name: 'Next street' }).click();
  assert.equal(await page.locator('.replay-board .card').count(), 3);
  await page.getByRole('button', { name: 'Turn', exact: true }).click();
  assert.equal(await page.locator('.replay-board .card').count(), 4);

  await page.getByRole('navigation').getByRole('link', { name: 'Study Notebook', exact: false }).click();
  await page.getByRole('textbox', { name: 'Title', exact: true }).fill('React migration check');
  await page.getByRole('textbox', { name: 'Your notes', exact: true }).fill('Study the position before acting.');
  await page.getByRole('button', { name: 'Save takeaway' }).click();
  await page.getByRole('heading', { name: 'React migration check' }).waitFor();
  await page.reload();
  await page.getByRole('heading', { name: 'React migration check' }).waitFor();
  await page.getByRole('button', { name: 'Delete note: React migration check' }).click();
  assert.equal(await page.locator('.saved-note').count(), 0);

  await page.getByRole('navigation').getByRole('link', { name: 'AI Arena' }).click();
  await expect(page.locator('.speech-bubble')).toHaveCount(3);
  await expect(page.getByRole('button', { name: 'Bet 8 bb', exact: true })).toBeDisabled();
  await expect(page.locator('.arena-community .card')).toHaveCount(5);
  await expect(page.getByRole('button', { name: 'Bet 8 bb', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Bet 8 bb', exact: true }).click();
  await expect(page.locator('.arena-stage')).toHaveAttribute('data-playing', 'true');
  await expect(page.locator('.arena-outcome')).toBeVisible({ timeout: 15000 });
  await expect(page.locator('.arena-actions button')).toHaveText('Deal next hand →');
  await page.getByRole('button', { name: 'Deal next hand' }).click();
  await expect(page.locator('.arena-outcome')).toHaveCount(0);
  await page.getByRole('navigation').getByRole('link', { name: 'Overview' }).first().click();
  const pausedStatus = await page.locator('.dealer-status').textContent();
  await page.waitForTimeout(400);
  assert.equal(await page.locator('.dealer-status').textContent(), pausedStatus);
  await page.getByRole('navigation').getByRole('link', { name: 'AI Arena' }).click();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('.arena-stage')).toHaveAttribute('data-dealing', 'false');
  assert.equal(await page.locator('.arena-bot .bot-avatar').first().evaluate(element => getComputedStyle(element).animationName), 'none');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.getByRole('button', { name: 'Cinematic play', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Quick play', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Mute table talk' }).click();
  await expect(page.locator('.speech-bubble')).toHaveCount(0);
  await page.getByRole('button', { name: 'Show table talk' }).click();
  await expect(page.locator('.speech-bubble')).toHaveCount(3);
  await page.getByRole('button', { name: 'Read the opponent', exact: false }).click();
  await page.getByRole('button', { name: 'Assume every bet is a bluff', exact: false }).click();
  await expect(page.locator('.read-game .answer-indicator.incorrect')).toBeVisible();
  await page.getByRole('button', { name: 'Next opponent' }).click();
  await expect(page.locator('.read-game .answer-indicator')).toHaveCount(0);

  // Provider calls are mocked here; these checks do not consume API quota.
  await page.route('**/api/health', route => route.fulfill({ json: { status: 'ok', configured: true } }));
  let chatFails = false;
  const submitted = [];
  await page.route('**/api/chat', async route => {
    submitted.push(route.request().postDataJSON());
    await route.fulfill(chatFails
      ? { status: 503, json: { detail: 'Add GROQ_API_KEY to the server .env file.' } }
      : { json: { reply: 'Position gives you more information before acting.' } });
  });
  await page.getByRole('navigation').getByRole('link', { name: 'AI Coach' }).click();
  const question = page.getByRole('textbox', { name: 'Your question' });
  await question.fill('Why does position matter?');
  await page.getByRole('button', { name: 'Ask the coach' }).click();
  await expect(page.locator('.coach-message.assistant')).toHaveText(/Position gives you more information/);
  assert.equal(submitted[0].messages[0].content, 'Why does position matter?');
  await page.getByRole('combobox', { name: 'Coaching style' }).selectOption('roast');
  chatFails = true;
  await question.fill('Give me an example.');
  await page.getByRole('button', { name: 'Ask the coach' }).click();
  await expect(page.getByRole('alert')).toHaveText(/Add GROQ_API_KEY/);
  await expect(question).toHaveValue('Give me an example.');
  assert.equal(submitted[1].mode, 'roast');
  assert.equal(submitted[1].messages.length, 3);
  chatFails = false;
  await page.getByRole('button', { name: 'Ask the coach' }).click();
  await expect(page.locator('.coach-message.assistant')).toHaveCount(2);
  await page.getByRole('button', { name: 'New chat' }).click();
  await expect(page.locator('.coach-message')).toHaveCount(0);

  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const route of ['overview', 'ranges', 'practice', 'hands', 'notebook', 'coach', 'arena']) {
      await page.goto(`${baseUrl}/doc.html#${route}`);
      await page.locator(`#${route}`).waitFor({ state: 'visible' });
      if (route === 'arena') await expect(page.locator('.arena-stage')).toHaveAttribute('data-dealing', 'false');
      if (route === 'arena') await page.screenshot({ path: `/tmp/pokerttool-arena-${width}.png`, fullPage: true, animations: 'disabled' });
      if (route === 'overview') await page.screenshot({ path: `/tmp/pokerttool-react-${width}.png`, fullPage: true, animations: 'disabled' });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `Page overflows at ${width}px: ${route}`);
    }
  }
  assert.deepEqual(errors, []);
  console.log('PASS: themes, range filters, keyboard scoring, shared session results, replays, notebook persistence, arena showdown, speech bubbles, opponent quiz, chat history, provider errors, retry, both entry points, mobile layout, and no browser errors.');
} finally {
  await browser.close();
}
