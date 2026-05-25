import { test, expect } from '@playwright/test';
import { ExpensesPage } from '../../pages/ExpensesPage';
import { SchedulesPage } from '../../pages/SchedulesPage';
import { StudentsPage } from '../../pages/StudentsPage';
import { TeachersPage } from '../../pages/TeachersPage';
import { authRequiredMessage, hasAuthConfig } from '../../utils/test-env';

test.describe('Search placeholders and phone search @session-features', () => {
  test.skip(!hasAuthConfig(), authRequiredMessage);

  test('shows the expected search placeholders @regression', async ({ page }) => {
    const students = new StudentsPage(page);
    await students.goto();
    await expect(page.getByPlaceholder('Buscar por nombre, documento o teléfono...')).toBeVisible();

    const teachers = new TeachersPage(page);
    await teachers.goto();
    await expect(page.getByPlaceholder('Buscar por nombre, documento o teléfono...')).toBeVisible();

    const expenses = new ExpensesPage(page);
    await expenses.goto();
    await expect(page.getByPlaceholder('Buscar por descripción, categoría u horario...')).toBeVisible();

    const schedules = new SchedulesPage(page);
    await schedules.goto();
    await expect(page.getByPlaceholder('Buscar por curso, nivel, profesor o días...')).toBeVisible();
  });

  test('filters students by phone number @regression', async ({ page }) => {
    const students = new StudentsPage(page);
    const suffix = Date.now().toString().slice(-8);
    const phone = `966${suffix.slice(0, 6)}`;

    await students.goto();
    await students.createStudent({
      firstName: 'E2E',
      lastName: `Teléfono ${suffix}`,
      docNumber: `66${suffix}`,
      phone,
    });
    await expect(students.rows.filter({ hasText: phone }).first()).toBeVisible();

    await students.search(phone);
    await expect(students.rows.first()).toContainText(phone);

    await students.rows.first().getByRole('button', { name: /eliminar/i }).click();
    await students.confirmDelete();
  });

  test('filters teachers by phone number @regression', async ({ page }) => {
    const teachers = new TeachersPage(page);
    const suffix = Date.now().toString().slice(-8);
    const phone = `955${suffix.slice(0, 6)}`;

    await teachers.goto();
    await teachers.createTeacher({
      firstName: 'E2E',
      lastName: `Profesor ${suffix}`,
      docNumber: `55${suffix}`,
      phone,
      specialty: 'E2E',
    });
    await expect(teachers.rows.filter({ hasText: phone }).first()).toBeVisible();

    await teachers.search(phone);
    await expect(teachers.rows.first()).toContainText(phone);

    await teachers.rows.first().getByRole('button', { name: /eliminar/i }).click();
    await teachers.confirmDelete();
  });
});
