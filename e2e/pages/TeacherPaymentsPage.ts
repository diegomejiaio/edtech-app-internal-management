import { expect, type Page } from '@playwright/test';
import { BasePage } from './BasePage';

export class TeacherPaymentsPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async goto() {
    await this.gotoPath('/teacher-payments');
  }

  async openNewPaymentForm() {
    await this.page.getByRole('button', { name: /nuevo pago/i }).click();
    await expect(this.dialog.getByRole('heading', { name: 'Nuevo pago profesor' })).toBeVisible();
  }
}
