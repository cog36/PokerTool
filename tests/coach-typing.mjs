import { chromium, expect } from '@playwright/test';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
 const page = await browser.newPage();
 await page.route('**/api/health', route => route.fulfill({ json: { configured: true } }));
 const reply = '### Position matters\n\n' + 'Compare the price with your range before committing more chips. '.repeat(18) + '\n\n**Final takeaway:** review the action first.';
 await page.route('**/api/chat', route => route.fulfill({ json: { reply } }));
 await page.goto(`${process.env.FRONTEND_URL || 'http://127.0.0.1:5173'}/#coach`);
 await expect(page.getByRole('link', { name: 'Hand Library' })).toHaveCount(0);
 await page.getByRole('textbox', { name: 'Message your coach' }).fill('Explain position.');
 await page.getByRole('button', { name: 'Send message' }).click();
 await expect(page.getByRole('button', { name: 'Show full response' })).toBeVisible();
 const response = page.locator('.coach-reply');
 await expect(response).toContainText('Position');
 await expect(response).not.toContainText('Final takeaway:');
 await page.getByRole('button', { name: 'Show full response' }).click();
 await expect(response).toContainText('Final takeaway:');
 await expect(response.locator('strong')).toHaveText('Final takeaway:');
 await page.getByRole('button', { name: 'New chat' }).click();
 await page.getByRole('textbox', { name: 'Message your coach' }).fill('Try again.');
 await page.getByRole('button', { name: 'Send message' }).click();
 await expect(page.getByRole('button', { name: 'Show full response' })).toBeVisible();
 await page.getByRole('button', { name: 'New chat' }).click();
 await expect(page.locator('.coach-message')).toHaveCount(0);
 await expect(page.locator('.coach-welcome')).toBeVisible();
 console.log('PASS: gradual reply, skip to full formatted response, new-chat cancellation and no Hand Library link.');
} finally { await browser.close(); }
