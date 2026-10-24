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

  await page.route('**/api/analyze', route => route.fulfill({ json: {
    filename: 'sample-hands.txt',
    total_hands_analyzed: 1,
    total_mistakes_detected: 1,
    critical_blunders_count: 1,
    leak_breakdown: { played_weak_hands: 1, folded_playable_hands: 0, passive_calls_on_premiums: 0 },
    hands: [{
      hand_id: 'TM123',
      matrix_key: '72o',
      position: 'UTG',
      stack_depth_bb: 50,
      facing_action: 'UNOPENED',
      opener_position: null,
      net_profit: -10,
      recommended_action: 'FOLD',
      deviation_type: 'Played Loose in UTG',
      feedback: 'You opened 72o from UTG.',
      severity: 'CRITICAL',
      raw_cards: '7s 2h',
      board: '',
      actions_before_hero: [],
    }],
  } }));
  await page.getByRole('navigation').getByRole('link', { name: 'Session Analysis' }).click();
  await page.getByLabel('Choose a GG Poker hand-history file').setInputFiles({
    name: 'sample-hands.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('sample hand history'),
  });
  await page.getByRole('button', { name: 'Analyze session' }).click();
  await expect(page.getByText('Analyzed 1 hands from sample-hands.txt.')).toBeVisible();
  await expect(page.locator('.analysis-stats strong').first()).toHaveText('1');
  await expect(page.locator('.analysis-hand summary')).toContainText('72o · UTG');
  await page.locator('.analysis-hand summary').click();
  await expect(page.locator('.analysis-hand-content')).toContainText('You opened 72o from UTG.');
  await page.route('**/api/analyze', route => route.fulfill({ status: 500, contentType: 'text/html', body: 'proxy error' }));
  await page.getByLabel('Choose a GG Poker hand-history file').setInputFiles({
    name: 'another-sample.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('sample hand history'),
  });
  await page.getByRole('button', { name: 'Analyze session' }).click();
  await expect(page.getByRole('alert')).toHaveText(/Python API is not responding correctly/);

  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const route of ['overview', 'analysis', 'ranges', 'practice', 'hands', 'notebook', 'coach']) {
      await page.goto(`${baseUrl}/doc.html#${route}`);
      await page.locator(`#${route}`).waitFor({ state: 'visible' });
      if (route === 'overview') await page.screenshot({ path: `/tmp/pokerttool-react-${width}.png`, fullPage: true });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `Page overflows at ${width}px: ${route}`);
    }
  }
  assert.deepEqual(errors, []);
  console.log('PASS: themes, range filters, keyboard scoring, shared session results, hand-history upload display, replays, notebook persistence, chat history, provider errors, retry, both entry points, mobile layout, and no browser errors.');
} finally {
  await browser.close();
}
