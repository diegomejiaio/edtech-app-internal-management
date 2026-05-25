import { test as setup, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const authFile = path.join(__dirname, '..', 'fixtures', '.auth', 'user.json');

setup('authenticate', async ({ page }) => {
  fs.mkdirSync(path.dirname(authFile), { recursive: true });

  if (!process.env.TEST_USER_EMAIL || !process.env.TEST_USER_PASSWORD) {
    console.warn('Skipping Clerk login: TEST_USER_EMAIL/TEST_USER_PASSWORD are not configured.');
    fs.writeFileSync(authFile, JSON.stringify({ cookies: [], origins: [] }, null, 2));
    return;
  }

  await page.goto('/sign-in');

  await page.getByLabel('Email').fill(process.env.TEST_USER_EMAIL);
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('textbox', { name: 'Password', exact: true }).fill(process.env.TEST_USER_PASSWORD);
  await page.getByRole('button', { name: 'Continue' }).click();

  await page.waitForURL('**/dashboard**');
  await expect(page).toHaveURL(/dashboard/);

  await page.context().storageState({ path: authFile });
});
