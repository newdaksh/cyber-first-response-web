import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('completes the primary incident response journey', async ({ page }) => {
  await openRestoredCase(page);
  await expect(page.getByRole('heading', { name: /Got scammed/i })).toBeVisible();
  await expectNoAccessibilityViolations(page);

  await page.getByRole('button', { name: /Load ₹25,000 demo incident/i }).click();
  await expect(page.getByRole('heading', { name: /Here's what we understood/i })).toBeVisible();
  await page.getByLabel(/Where did the incident occur/i).selectOption({ label: 'Other' });
  await page.getByLabel(/When did you first notice/i).selectOption({ label: 'Today' });
  await page.getByRole('button', { name: /Show my first-response plan/i }).click();

  const actions = page.locator('.action-row');
  await expect(actions).toHaveCount(5);
  for (let index = 0; index < 5; index += 1) await actions.nth(index).click();
  await page.getByRole('button', { name: /Collect my evidence/i }).click();
  await page.getByRole('button', { name: /Use built-in demo receipt/i }).click();
  await page.getByRole('button', { name: /Store evidence details/i }).click();
  await page.getByRole('button', { name: /Build incident timeline/i }).click();
  await expect(page.getByRole('heading', { name: /step by step/i })).toBeVisible();
  await page.getByRole('button', { name: /Open my case file/i }).click();
  await page.getByRole('button', { name: /Prepare complaint draft/i }).click();

  const checks = page.locator('.review-checklist').getByRole('checkbox');
  await expect(checks).toHaveCount(4);
  for (let index = 0; index < (await checks.count()); index += 1) await checks.nth(index).check();
  await expectNoAccessibilityViolations(page);
  await page.getByRole('button', { name: /I have reviewed this/i }).click();
  await page.getByRole('button', { name: /Prepare official handoff/i }).click();
  await expect(page.getByRole('heading', { name: /complaint package/i })).toBeVisible();
});

test('keeps the transparency dialog keyboard-contained and available on mobile', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openRestoredCase(page);
  const trigger = page.getByRole('button', { name: 'What is simulated?' });
  await expect(trigger).toBeVisible();
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: /What works/i });
  await expect(dialog).toBeVisible();
  await expectNoAccessibilityViolations(page);
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});

async function expectNoAccessibilityViolations(page: import('@playwright/test').Page) {
  const results = await new AxeBuilder({ page }).analyze();
  expect(
    results.violations,
    results.violations.map((item) => `${item.id}: ${item.help}`).join('\n'),
  ).toEqual([]);
}

async function openRestoredCase(page: import('@playwright/test').Page) {
  const restored = page.waitForResponse(
    (response) =>
      response.request().method() === 'GET' && new URL(response.url()).pathname === '/api/case',
  );
  await page.goto('/');
  await restored;
}
