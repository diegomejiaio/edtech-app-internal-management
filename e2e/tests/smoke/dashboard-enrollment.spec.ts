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
    await expect(page.getByText('Matricula un alumno en un horario activo')).toBeVisible();
    await expect(page.getByText('Alumno')).toBeVisible();
    await expect(page.getByRole('button', { name: '+ Crear alumno' })).toBeVisible();
    await expect(page.getByText('Horario')).toBeVisible();
    await expect(page.getByLabel('Fecha de inscripción')).toBeVisible();
    await expect(page.getByText('Pago inicial (opcional)')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Matricular' })).toBeVisible();
  });
});
