import { test, expect } from '@playwright/test';

test.describe('Navigation @smoke', () => {
  test('should load dashboard after login', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/dashboard/);
    await expect(page.locator('nav')).toBeVisible();
  });

  test('should navigate to students page', async ({ page }) => {
    await page.goto('/dashboard');
    await page.getByRole('link', { name: /estudiantes/i }).click();
    await expect(page).toHaveURL(/students/);
  });

  test('should navigate to debtors page', async ({ page }) => {
    await page.goto('/dashboard');
    await page.getByRole('link', { name: /deudores|morosos/i }).click();
    await expect(page).toHaveURL(/debtors/);
  });
});
