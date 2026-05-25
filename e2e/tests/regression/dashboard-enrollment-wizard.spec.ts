import { test, expect } from '@playwright/test';
import { DashboardPage } from '../../pages/DashboardPage';
import { hasCosmosConfig, queryCosmosDB, verifyDocumentCreated } from '../../utils/cosmos-helpers';
import { authRequiredMessage, hasAuthConfig } from '../../utils/test-env';

test.describe('Dashboard enrollment wizard @session-features', () => {
  test.skip(!hasAuthConfig(), authRequiredMessage);

  test('opens the unified Nueva matrícula wizard from dashboard @smoke', async ({ page }) => {
    const dashboard = new DashboardPage(page);
    await dashboard.goto();
    await dashboard.openNewEnrollmentWizard();

    await expect(dashboard.dialog.getByText('Matricula un alumno en un horario activo')).toBeVisible();
    await expect(dashboard.dialog.getByRole('button', { name: '+ Crear alumno' })).toBeVisible();
    await expect(dashboard.dialog.getByText('Pago inicial (opcional)')).toBeVisible();
    await expect(dashboard.dialog.getByRole('button', { name: 'Matricular' })).toBeVisible();
    await expect(dashboard.dialog).not.toContainText('QuickEnrollmentSheet');
  });

  test('creates an enrollment from the dashboard wizard @write-heavy', async ({ page }) => {
    test.setTimeout(90_000);
    const dashboard = new DashboardPage(page);
    const suffix = Date.now().toString().slice(-8);
    const docNumber = `88${suffix}`;

    await dashboard.goto();
    await dashboard.openNewEnrollmentWizard();
    await dashboard.dialog.getByRole('button', { name: '+ Crear alumno' }).click();
    await dashboard.dialog.getByLabel(/N° Documento/).fill(docNumber);
    await dashboard.dialog.getByLabel('Nombre').fill('E2E');
    await dashboard.dialog.getByLabel('Apellido').fill(`Wizard ${suffix}`);
    await dashboard.dialog.getByLabel('Teléfono').fill(`999${suffix.slice(0, 6)}`);

    const hasSchedule = await dashboard.selectFirstCommandItemByLabel(dashboard.dialog, 'Horario');
    test.skip(!hasSchedule, 'Requires at least one active schedule to create an enrollment.');

    await dashboard.dialog.getByRole('button', { name: 'Matricular' }).click();
    await expect(dashboard.dialog).toBeHidden({ timeout: 60_000 });

    if (!hasCosmosConfig()) {
      console.log('Skipping Cosmos DB audit checks: COSMOSDB_CONNECTION_STRING/COSMOSDB_DATABASE are not configured.');
      return;
    }

    const student = await verifyDocumentCreated('Student', `c.docNumber = '${docNumber}'`, 'master');
    const studentId = student.id as string;
    const enrollments = await queryCosmosDB(
      `SELECT * FROM c WHERE c.type = 'Enrollment' AND c.studentId = '${studentId}'`,
      'operations',
    );
    expect(enrollments.length).toBeGreaterThan(0);
    const enrollment = enrollments[0];
    expect(enrollment.createdAt).toBeTruthy();
    expect(enrollment.createdBy).toBeTruthy();
    expect(enrollment.deletedAt ?? null).toBeNull();
  });
});
