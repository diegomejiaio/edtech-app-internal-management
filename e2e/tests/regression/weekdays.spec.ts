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
    await expect(page.getByText(/días/i)).toBeVisible();
  });

  test('should show existing weekday items', async () => {
    // Catalog should have pre-seeded items (L, Ma, Mi, etc.)
    await expect(weekdaysPage.badges.first()).toBeVisible();
  });

  test('should add a new weekday value', async ({ page }) => {
    await weekdaysPage.clickNew();
    await weekdaysPage.fillAndSubmit('LMaJ');
    await expect(page.getByText('LMaJ')).toBeVisible();
  });
});
