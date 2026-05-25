import { test } from '@playwright/test';
import { ExpensesPage } from '../../pages/ExpensesPage';
import { StudentPaymentsPage } from '../../pages/StudentPaymentsPage';
import { TeacherPaymentsPage } from '../../pages/TeacherPaymentsPage';
import { authRequiredMessage, hasAuthConfig } from '../../utils/test-env';

test.describe('Form spacing and payment filters @session-features', () => {
  test.skip(!hasAuthConfig(), authRequiredMessage);

  test('keeps visible label/input gaps in Nuevo pago profesor @regression', async ({ page }) => {
    const teacherPayments = new TeacherPaymentsPage(page);
    await teacherPayments.goto();
    await teacherPayments.openNewPaymentForm();
    for (const label of ['Profesor', 'Fecha', 'Monto (S/)', 'Concepto', 'Medio de pago', 'Notas']) {
      await teacherPayments.expectLabelInputGap(label);
    }
  });

  test('keeps visible label/input gaps in Nuevo gasto @regression', async ({ page }) => {
    const expenses = new ExpensesPage(page);
    await expenses.goto();
    await expenses.openNewExpenseForm();
    for (const label of ['Fecha', 'Categoría', 'Descripción', 'Monto (S/)', 'Medio de pago', 'Horario (opcional)', 'Notas']) {
      await expenses.expectLabelInputGap(label);
    }
  });

  test('does not render date filters in student payments toolbar @regression', async ({ page }) => {
    const payments = new StudentPaymentsPage(page);
    await payments.goto();
    await payments.expectNoToolbarDateFilters();
  });
});
