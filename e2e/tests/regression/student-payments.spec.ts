import { expect, test } from '@playwright/test';
import { StudentPaymentsPage } from '../../pages/StudentPaymentsPage';
import { mockEspacioProApi, mockStudentPayments } from '../../utils/api-mocks';

function todayIsoDate() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

test.describe('Student payments @regression', () => {
  let studentPaymentsPage: StudentPaymentsPage;

  test.beforeEach(async ({ page }) => {
    await mockEspacioProApi(page);
    studentPaymentsPage = new StudentPaymentsPage(page);
    await studentPaymentsPage.goto();
  });

  test('should default the new payment date to today', async () => {
    await studentPaymentsPage.openNewPayment();

    await expect(studentPaymentsPage.paymentSheet).toBeVisible();
    await expect(studentPaymentsPage.dateInput).toHaveValue(todayIsoDate());
  });

  test('should show payment history and balance summary after selecting an active enrollment', async ({ page }) => {
    await studentPaymentsPage.openNewPayment();
    await studentPaymentsPage.selectEnrollment('Ana Pago');

    await expect(page.getByText('Pagos registrados')).toBeVisible();
    await expect(page.getByText('Saldo pendiente')).toBeVisible();
    await expect(page.getByText('Precio')).toBeVisible();
    await expect(page.getByText('Pagado')).toBeVisible();
    await expect(page.getByText('Pendiente')).toBeVisible();
    await expect(page.getByText('S/ 400.00')).toBeVisible();
    await expect(page.getByText('S/ 150.00')).toBeVisible();
    await expect(page.getByText('S/ 250.00')).toHaveCount(2);

    for (const payment of mockStudentPayments) {
      await expect(page.getByText(`S/ ${payment.amount.toFixed(2)} · Cuota ${payment.installmentNumber}`)).toBeVisible();
      await expect(page.getByText(payment.paymentMethod)).toBeVisible();
    }

    await expect(page.getByText('Boleta B001-0001')).toBeVisible();
    await expect(page.getByText('Registrado')).toHaveCount(mockStudentPayments.length);
  });
});
