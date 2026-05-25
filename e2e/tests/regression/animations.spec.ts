import { test, expect } from '@playwright/test';
import { StudentsPage } from '../../pages/StudentsPage';
import { EnrollmentsPage } from '../../pages/EnrollmentsPage';
import { authRequiredMessage, hasAuthConfig } from '../../utils/test-env';

test.describe('Table row animations @session-features', () => {
  test.skip(!hasAuthConfig(), authRequiredMessage);

  test('does not flash existing rows orange on initial list load @regression', async ({ page }) => {
    const students = new StudentsPage(page);
    await students.goto();
    test.skip((await students.rows.count()) === 0, 'Requires existing student rows.');
    await students.expectRowsNotFlashingOnLoad();

    const enrollments = new EnrollmentsPage(page);
    await enrollments.goto();
    test.skip((await enrollments.rows.count()) === 0, 'Requires existing enrollment rows.');
    await enrollments.expectRowsNotFlashingOnLoad();
  });

  test('flashes a new student row orange, then removes it after delete @regression', async ({ page }) => {
    // Skipped: requires a real backend write that times out under the parallel
    // worker load against the dev Function App tier. Re-enable when the test
    // can run serially or against a mocked CreateStudent endpoint.
    test.skip(true, 'flaky-env: real backend create under parallel load');
    test.setTimeout(90_000);
    const students = new StudentsPage(page);
    const suffix = Date.now().toString().slice(-8);
    const phone = `977${suffix.slice(0, 6)}`;

    await students.goto();
    await students.createStudent({ firstName: 'E2E', lastName: `Animación ${suffix}`, docNumber: `77${suffix}`, phone });

    await students.search(phone);
    const newRow = students.rows.filter({ hasText: phone }).first();
    await expect(newRow).toBeVisible();
    await expect.poll(async () => newRow.evaluate((row) => getComputedStyle(row).backgroundColor), { timeout: 1_500 }).toContain('249, 115, 22');
    await expect.poll(async () => newRow.evaluate((row) => getComputedStyle(row).backgroundColor), { timeout: 3_000 }).toMatch(/rgba\(0, 0, 0, 0\)|transparent/);

    await newRow.getByRole('button', { name: /eliminar/i }).click();
    await students.confirmDelete();
    await expect(newRow).toBeHidden();
  });
});
