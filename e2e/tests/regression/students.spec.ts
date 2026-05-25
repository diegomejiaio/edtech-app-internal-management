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

  test('should filter students by search', async () => {
    const allCount = await studentsPage.rows.count();
    test.skip(allCount === 0, 'No students seeded to filter');

    const firstRowText = (await studentsPage.rows.first().innerText()).split('\n')[0];
    const term = firstRowText.split(/\s+/)[0];

    await studentsPage.search(term);
    await expect(studentsPage.rows.first()).toContainText(term);
  });

  test('should open new student form', async ({ page }) => {
    await studentsPage.clickNewStudent();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByLabel(/nombre/i)).toBeVisible();
  });
});
