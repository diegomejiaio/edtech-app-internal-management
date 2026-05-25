import { test as setup, expect } from '@playwright/test';
import path from 'path';

const authFile = path.join(__dirname, '.auth/user.json');

setup('authenticate', async ({ page }) => {
  await page.goto('/sign-in');

  // Clerk sign-in flow
  await page.getByLabel('Email').fill(process.env.TEST_USER_EMAIL || '');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByLabel('Password').fill(process.env.TEST_USER_PASSWORD || '');
  await page.getByRole('button', { name: 'Continue' }).click();

  // Wait for redirect to dashboard
  await page.waitForURL('**/dashboard**');
  await expect(page).toHaveURL(/dashboard/);

  // Save auth state for reuse
  await page.context().storageState({ path: authFile });
});
