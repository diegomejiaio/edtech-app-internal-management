import { expect, test } from '@playwright/test';
import { CollectionsPage } from '../../pages/CollectionsPage';
import { PeoplePage } from '../../pages/PeoplePage';
import { mockEspacioProApi } from '../../utils/api-mocks';

test.describe('Implemented UI copy @regression', () => {
  test.beforeEach(async ({ page }) => {
    await mockEspacioProApi(page);
  });

  test('should show collections placeholder copy', async ({ page }) => {
    const collectionsPage = new CollectionsPage(page);

    await collectionsPage.goto();

    await expect(collectionsPage.placeholderTitle).toBeVisible();
    await expect(page.getByText('Estamos construyendo esta sección. Las cobranzas estarán disponibles pronto.')).toBeVisible();
    await expect(page.getByText('No hay cobranzas pendientes')).toBeHidden();
  });

  test('should mention phone in students search placeholder', async ({ page }) => {
    const studentsPage = new PeoplePage(page, '/students');

    await studentsPage.goto();

    await expect(studentsPage.searchInput).toBeVisible();
  });

  test('should mention phone in teachers search placeholder', async ({ page }) => {
    const teachersPage = new PeoplePage(page, '/teachers');

    await teachersPage.goto();

    await expect(teachersPage.searchInput).toBeVisible();
  });
});
