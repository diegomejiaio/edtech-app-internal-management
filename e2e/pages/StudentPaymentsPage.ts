import { expect, type Locator, type Page } from '@playwright/test';
import { BasePage } from './BasePage';

export class StudentPaymentsPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async goto() {
    await this.gotoPath('/student-payments');
  }

  get newPaymentButton(): Locator {
    return this.page.getByRole('button', { name: /nuevo pago/i });
  }

  get paymentSheet(): Locator {
    return this.page.getByRole('dialog');
  }

  get dateInput(): Locator {
    return this.paymentSheet.getByLabel('Fecha');
  }

  async openNewPayment() {
    await this.newPaymentButton.click();
  }

  async selectEnrollment(studentName: string) {
    await this.paymentSheet.getByRole('combobox').first().click();
    await this.page.getByRole('option', { name: new RegExp(studentName, 'i') }).click();
  }

  async expectNoToolbarDateFilters() {
    await expect(this.page.getByRole('heading', { name: /pagos de alumnos/i })).toBeVisible();
    await expect(this.page.locator('main input[type="date"]')).toHaveCount(0);
  }
}
