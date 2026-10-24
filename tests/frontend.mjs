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
  await page.getByRole('heading', { name: /Welcome to the table/ }).waitFor();
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

  await page.getByRole('navigation').getByRole('link', { name: 'Overview', exact: false }).first().click();
  await page.getByRole('checkbox').first().check();
  await page.getByRole('navigation').getByRole('link', { name: 'Study Notebook', exact: false }).click();
  await page.getByRole('textbox', { name: 'Title', exact: true }).fill('React migration check');
  await page.getByRole('textbox', { name: 'Your notes', exact: true }).fill('Study the position before acting.');
  await page.getByRole('button', { name: 'Save takeaway' }).click();
  await page.getByRole('heading', { name: 'React migration check' }).waitFor();
  await page.reload();
  await page.getByRole('heading', { name: 'React migration check' }).waitFor();
  await page.getByRole('button', { name: 'Delete note: React migration check' }).click();
  assert.equal(await page.locator('.saved-note').count(), 0);

  // A fixed random source keeps the seven-opponent table reproducible for layout and gameplay checks.
  await page.addInitScript(() => { Math.random = () => .999; });
  await page.goto(`${baseUrl}/#arena`);
  await page.reload();
  await expect(page.locator('.arena-bot')).toHaveCount(7);
  await page.getByRole('button', { name: 'Show table talk' }).click();
  await expect(page.locator('.speech-bubble')).toHaveCount(7);
  await expect(page.locator('.arena-community .card')).toHaveCount(0);
  await expect(page.locator('.board-card-space')).toHaveCount(5);
  await expect(page.locator('.arena-streets [aria-current="step"]')).toHaveText('Preflop');
  await page.getByRole('button', { name: 'Cinematic play', exact: true }).click();
  async function waitForDecision() {
    await expect(page.locator('.arena-stage')).toHaveAttribute('data-dealing', 'false', { timeout: 15000 });
    await expect(page.locator('.arena-stage')).toHaveAttribute('data-playing', 'false', { timeout: 20000 });
    await expect(page.locator('.skip-playback')).toHaveCount(0, { timeout: 20000 });
  }
  await waitForDecision();
  await expect(page.locator('.arena-community .card')).toHaveCount(0);
  await expect(page.locator('.arena-action-log')).toContainText('posts');
  assert.equal(await page.locator('.archetype-tag').count(), 7);
  const firstHeroSeat = await page.locator('.arena-hero').getAttribute('data-physical-seat');
  const firstHeroPosition = await page.locator('.decision-context > span').first().locator('strong').textContent();
  const firstRoster = (await page.locator('.archetype-tag').allTextContents()).sort();
  assert.ok(await page.locator('.wager-pile').count() >= 2);
  await expect(page.locator('.tournament-mode-note')).toContainText('CHIP EV');

  let decisions = 0;
  while (!await page.locator('.arena-outcome').count()) {
    assert.ok(++decisions < 80, 'The hand should finish');
    await page.locator('.arena-actions').getByRole('button', { name: /^(Check|Call )/ }).click();
    await waitForDecision();
  }
  await expect(page.locator('.arena-community .card')).toHaveCount(5);
  for (const street of ['Preflop', 'Flop', 'Turn', 'River']) {
    await expect(page.locator('.history-street').getByRole('heading', { name: street, exact: true })).toHaveCount(1);
  }
  await expect(page.locator('.arena-sidebar .practice-metrics strong').first()).toHaveText('1');
  await page.locator('.arena-actions').getByRole('button').click();
  await expect(page.locator('.arena-community .card')).toHaveCount(0);
  await page.getByRole('navigation').getByRole('link', { name: 'Overview' }).first().click();
  await expect(page.locator('#overview')).toBeVisible();
  const pausedStatus = await page.locator('.dealer-status').textContent();
  await page.waitForTimeout(400);
  assert.equal(await page.locator('.dealer-status').textContent(), pausedStatus);
  await page.getByRole('navigation').getByRole('link', { name: 'AI Arena' }).click();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await waitForDecision();
  assert.notEqual(await page.locator('.decision-context > span').first().locator('strong').textContent(), firstHeroPosition);
  assert.notDeepEqual((await page.locator('.archetype-tag').allTextContents()).sort(), firstRoster);
  assert.equal(await page.locator('.arena-bot .bot-avatar').first().evaluate(element => getComputedStyle(element).animationName), 'none');
  await page.getByRole('button', { name: 'Mute table talk' }).click();
  await expect(page.locator('.speech-bubble')).toHaveCount(0);
  await page.getByRole('button', { name: 'Show table talk' }).click();
  await expect(page.locator('.speech-bubble')).toHaveCount(7);

  // A fresh roster still has eight total seats, regardless of the random source.
  await page.evaluate(() => { Math.random = () => .01; });
  await page.getByRole('button', { name: 'New random table', exact: true }).click();
  await expect(page.locator('.arena-bot')).toHaveCount(7);
  await waitForDecision();
  await expect(page.locator('.arena-community .card')).toHaveCount(0);
  assert.ok((await page.locator('.decision-context > span').first().locator('strong').textContent()).length > 0);
  await page.getByRole('button', { name: 'Read the opponent', exact: false }).click();
  await page.getByRole('button', { name: 'Assume every bet is a bluff', exact: false }).click();
  await expect(page.locator('.read-game .answer-indicator.incorrect')).toBeVisible();
  await page.getByRole('button', { name: 'Next opponent' }).click();
  await expect(page.locator('.read-game .answer-indicator')).toHaveCount(0);
  await page.emulateMedia({ reducedMotion: 'no-preference' });

  // Provider calls are mocked here; these checks do not consume API quota.
  await page.route('**/api/health', route => route.fulfill({ json: { status: 'ok', configured: true } }));
  let chatFails = false;
  const submitted = [];
  await page.route('**/api/chat', async route => {
    submitted.push(route.request().postDataJSON());
    await route.fulfill(chatFails
      ? { status: 503, json: { detail: { code: 'model_unavailable', message: 'The selected AI model is unavailable. Update GROQ_MODEL in backend/.env, then retry.', retryable: false } } }
      : { json: { reply: '**Position** gives you more information before acting.' } });
  });
  await page.getByRole('navigation').getByRole('link', { name: 'AI Coach' }).click();
  const question = page.getByRole('textbox', { name: 'Message your coach' });
  await page.getByRole('button', { name: 'Use a hand template' }).click();
  await expect(question).toHaveValue(/Position:/);
  await question.fill('Why does position matter?');
  await page.getByRole('button', { name: 'Send message' }).click();
  await expect(page.locator('.coach-message.assistant')).toHaveText(/Position gives you more information/);
  await expect(page.locator('.coach-message.assistant p strong')).toHaveText('Position');
  assert.equal(submitted[0].messages[0].content, 'Why does position matter?');
  await page.getByRole('combobox', { name: 'Coaching style' }).selectOption('roast');
  chatFails = true;
  await question.fill('Give me an example.');
  await page.getByRole('button', { name: 'Send message' }).click();
  await expect(page.getByRole('alert')).toHaveText(/selected AI model is unavailable/);
  await expect(question).toHaveValue('Give me an example.');
  assert.equal(submitted[1].mode, 'roast');
  assert.equal(submitted[1].messages.length, 3);
  chatFails = false;
  await page.getByRole('button', { name: 'Send message' }).click();
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
  await page.getByRole('navigation').getByRole('link', { name: 'AI Arena' }).click();
  await expect(page.getByRole('heading', { name: 'AI Arena.' })).toBeVisible();
  await page.getByRole('button', { name: 'Read the opponent' }).click();
  await expect(page.getByRole('heading', { name: 'Read the opponent' })).toBeVisible();

  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const route of ['overview', 'analysis', 'ranges', 'arena', 'notebook', 'coach']) {
      await page.goto(`${baseUrl}/doc.html#${route}`);
      await page.locator(`#${route}`).waitFor({ state: 'visible' });
      if (route === 'coach') await page.screenshot({ path: `/tmp/pokerttool-coach-${width}.png`, fullPage: true, animations: 'disabled' });
      if (route === 'arena') await expect(page.locator('.arena-stage')).toHaveAttribute('data-dealing', 'false');
      if (route === 'arena') {
        await expect(page.locator('.arena-bot')).toHaveCount(7);
        await expect(page.locator('.arena-hero')).toHaveCount(1);
        const fits = await page.locator('.arena-stage').evaluate(stage => {
          const table = stage.getBoundingClientRect();
          return [...stage.querySelectorAll('.bot-avatar')].every(avatar => {
            const seat = avatar.getBoundingClientRect();
            return seat.left >= table.left - 1 && seat.right <= table.right + 1 && seat.top >= table.top - 1 && seat.bottom <= table.bottom + 1;
          });
        });
        assert.ok(fits, `All seven opponent avatars fit the table at ${width}px`);
      }
      if (route === 'arena') await page.screenshot({ path: `/tmp/pokerttool-arena-${width}.png`, fullPage: true, animations: 'disabled' });
      if (route === 'overview') await page.screenshot({ path: `/tmp/pokerttool-react-${width}.png`, fullPage: true, animations: 'disabled' });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `Page overflows at ${width}px: ${route}`);
    }
  }
  assert.deepEqual(errors, []);
  console.log('PASS: themes, range filters, keyboard scoring, shared session results, replays, notebook persistence, full preflop-to-river hands, eight total seats, action history, speech bubbles, opponent quiz, chat history, provider errors, retry, both entry points, mobile layout, and no browser errors.');
} finally {
  await browser.close();
}
