import { expect, test } from '@playwright/test';
import { DashboardPage } from '../../pages/DashboardPage';
import { mockEspacioProApi } from '../../utils/api-mocks';

test.describe('Dashboard enrollment action @smoke', () => {
  test('should open the wizard-style enrollment flow from the dashboard action', async ({ page }) => {
    await mockEspacioProApi(page);
    const dashboardPage = new DashboardPage(page);

    await dashboardPage.goto();
    await dashboardPage.openNewEnrollment();

    await expect(dashboardPage.enrollmentWizard).toBeVisible();
    const dialog = dashboardPage.dialog;
    await expect(dialog.getByText('Matricula un alumno en un horario activo')).toBeVisible();
    await expect(dialog.getByText('Alumno', { exact: true })).toBeVisible();
    await expect(dialog.getByRole('button', { name: '+ Crear alumno' })).toBeVisible();
    await expect(dialog.getByText('Horario', { exact: true })).toBeVisible();
    await expect(dialog.getByLabel('Fecha de inscripción')).toBeVisible();
    await expect(dialog.getByText('Pago inicial (opcional)')).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Matricular' })).toBeVisible();
  });
});
