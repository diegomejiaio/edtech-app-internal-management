import { expect, type Page } from '@playwright/test';
import { BasePage } from './BasePage';

export class EnrollmentsPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async goto() {
    await this.gotoPath('/enrollments');
  }

  async openFirstEnrollmentForEdit() {
    await this.openFirstRowAction(/editar/i);
    await expect(this.dialog.getByRole('heading', { name: 'Editar inscripción' })).toBeVisible();
  }

  async openRegisterPaymentForm() {
    await this.dialog.getByRole('button', { name: /registrar pago/i }).click();
    await expect(this.dialog.getByRole('button', { name: /^Registrar pago$/ })).toBeVisible();
  }
}
