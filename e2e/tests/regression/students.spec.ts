import { test, expect } from '@playwright/test';
import { StudentsPage } from '../../pages/StudentsPage';

test.describe('Students CRUD @regression', () => {
  let studentsPage: StudentsPage;

  test.beforeEach(async ({ page }) => {
    studentsPage = new StudentsPage(page);
    await studentsPage.goto();
  });

  test('should display students table', async () => {
    await expect(studentsPage.table).toBeVisible();
  });

  test('should filter students by search', async ({ page }) => {
    await studentsPage.search('García');
    const rows = await studentsPage.rows.count();
    expect(rows).toBeGreaterThan(0);

    const firstRow = studentsPage.rows.first();
    await expect(firstRow).toContainText('García');
  });

  test('should open new student form', async ({ page }) => {
    await studentsPage.clickNewStudent();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByLabel(/nombre/i)).toBeVisible();
  });
});
