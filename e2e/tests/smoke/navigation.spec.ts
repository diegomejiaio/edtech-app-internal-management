import { test, expect } from '@playwright/test';

test.describe('Navigation @smoke', () => {
  test('should load dashboard after login', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/dashboard/);
    await expect(page.getByRole('complementary')).toBeVisible();
  });

  test('should navigate to students page', async ({ page }) => {
    await page.goto('/dashboard');
    await page.getByRole('link', { name: /^alumnos$/i }).click();
    await expect(page).toHaveURL(/students/);
  });

  test('should navigate to collections page', async ({ page }) => {
    await page.goto('/dashboard');
    await page.getByRole('link', { name: /^cobranzas$/i }).click();
    await expect(page).toHaveURL(/collections/);
  });
});
