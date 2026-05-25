import { test, expect } from '@playwright/test';
import { SpacesPage } from '../../pages/SpacesPage';

test.describe('Spaces @regression', () => {
  let spacesPage: SpacesPage;

  test.beforeEach(async ({ page }) => {
    spacesPage = new SpacesPage(page);
    await spacesPage.goto();
  });

  test('should display spaces page', async ({ page }) => {
    await expect(page).toHaveURL(/spaces/);
    await expect(page.getByText(/espacios/i)).toBeVisible();
  });

  test('should show empty state when no spaces exist', async () => {
    await expect(spacesPage.emptyState).toBeVisible();
  });

  test('should open new space form', async ({ page }) => {
    await spacesPage.clickNew();
    await expect(page.getByRole('dialog')).toBeVisible();
  });
});
