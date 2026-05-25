import { test, expect } from '@playwright/test';
import { EnrollmentsPage } from '../../pages/EnrollmentsPage';
import {
  hasCosmosConfig,
  queryCosmosDB,
  verifyDocumentCreated,
  verifyDocumentSoftDeleted,
} from '../../utils/cosmos-helpers';
import { authRequiredMessage, hasAuthConfig } from '../../utils/test-env';

test.describe('Enrollment payments block @session-features', () => {
  test.skip(!hasAuthConfig(), authRequiredMessage);

  test('lists payments when editing an enrollment @regression', async ({ page }) => {
    const enrollments = new EnrollmentsPage(page);
    await enrollments.goto();
    test.skip((await enrollments.rows.count()) === 0, 'Requires at least one existing enrollment.');

    await enrollments.openFirstEnrollmentForEdit();
    await expect(enrollments.dialog.getByText('Pagos de esta inscripción')).toBeVisible();
    await expect(enrollments.dialog.getByRole('button', { name: /registrar pago/i })).toBeVisible();
    await expect(enrollments.dialog.getByText(/Sin pagos registrados|S\/\s*\d/).first()).toBeVisible();
  });

  test('registers and deletes a student payment tied to the enrollment @write-heavy', async ({ page }) => {
    test.setTimeout(90_000);
    const enrollments = new EnrollmentsPage(page);
    const suffix = Date.now().toString().slice(-8);
    const notes = `E2E pago matrícula ${suffix}`;

    await enrollments.goto();
    test.skip((await enrollments.rows.count()) === 0, 'Requires at least one existing enrollment.');

    await enrollments.openFirstEnrollmentForEdit();
    await enrollments.openRegisterPaymentForm();
    await enrollments.dialog.getByPlaceholder('0.00').fill('1.50');
    await enrollments.dialog.getByLabel('Notas').fill(notes);
    await enrollments.selectFirstSelectOptionByLabel(enrollments.dialog, 'Medio de pago');
    await enrollments.dialog.getByRole('button', { name: /^Registrar pago$/ }).click();

    await expect(enrollments.dialog.getByText(notes)).toBeVisible({ timeout: 60_000 });

    let createdPayment: Record<string, unknown> | undefined;
    if (hasCosmosConfig()) {
      createdPayment = await verifyDocumentCreated(
        'StudentPayment',
        `c.notes = '${notes}'`,
        'operations',
      );
      expect(createdPayment.enrollmentId).toBeTruthy();
    } else {
      console.log('Skipping Cosmos DB audit checks: COSMOSDB_CONNECTION_STRING/COSMOSDB_DATABASE are not configured.');
    }

    page.once('dialog', (dialog) => dialog.accept());
    const paymentRow = enrollments.dialog
      .locator('div')
      .filter({ has: page.getByRole('button', { name: 'Eliminar pago' }) })
      .filter({ hasText: notes });
    await paymentRow.getByRole('button', { name: 'Eliminar pago' }).first().click();
    await expect(enrollments.dialog.getByText(notes)).toBeHidden();

    if (hasCosmosConfig() && createdPayment?.id) {
      const deleted = await queryCosmosDB(
        `SELECT * FROM c WHERE c.type = 'StudentPayment' AND c.id = '${createdPayment.id}'`,
        'operations',
      );
      expect(deleted.length).toBe(1);
      verifyDocumentSoftDeleted('StudentPayment', deleted[0]);
    }
  });
});
