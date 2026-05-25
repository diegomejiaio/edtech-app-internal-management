import { test, expect } from '@playwright/test';
import { StudentSourcesPage } from '../../pages/StudentSourcesPage';

test.describe('Student Sources catalog @regression', () => {
  let sourcesPage: StudentSourcesPage;

  test.beforeEach(async ({ page }) => {
    sourcesPage = new StudentSourcesPage(page);
    await sourcesPage.goto();
  });

  test('should display student sources page', async ({ page }) => {
    await expect(page).toHaveURL(/student-sources/);
    await expect(page.getByText(/fuentes/i)).toBeVisible();
  });

  test('should show existing source items', async () => {
    // Catalog should have pre-seeded items (Instagram, Tiktok, etc.)
    await expect(sourcesPage.badges.first()).toBeVisible();
  });

  test('should add a new source', async ({ page }) => {
    await sourcesPage.clickNew();
    await sourcesPage.fillAndSubmit('LinkedIn');
    await expect(page.getByText('LinkedIn')).toBeVisible();
  });
});
