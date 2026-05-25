import { test, expect } from '@playwright/test';
import { WeekdaysPage } from '../../pages/WeekdaysPage';

test.describe('Weekdays catalog @regression', () => {
  let weekdaysPage: WeekdaysPage;

  test.beforeEach(async ({ page }) => {
    weekdaysPage = new WeekdaysPage(page);
    await weekdaysPage.goto();
  });

  test('should display weekdays page', async ({ page }) => {
    await expect(page).toHaveURL(/weekdays/);
    await expect(page.getByRole('heading', { name: 'Días' })).toBeVisible();
  });

  test('should show existing weekday items', async () => {
    // Catalog should have pre-seeded items (L, Ma, Mi, etc.)
    await expect(weekdaysPage.badges.first()).toBeVisible();
  });

  test('should add a new weekday value', async ({ page }) => {
    // Use unique suffix per run: catalog values are persisted in Cosmos and a
    // duplicate would surface the toast `"X" ya existe`, breaking strict mode.
    const value = `LMaJ-${Date.now().toString().slice(-6)}`;
    await weekdaysPage.clickNew();
    await weekdaysPage.fillAndSubmit(value);
    await expect(page.getByText(value, { exact: true })).toBeVisible();
  });
});
