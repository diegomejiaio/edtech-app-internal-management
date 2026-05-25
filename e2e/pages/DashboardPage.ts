import { expect, type Locator, type Page } from '@playwright/test';
import { BasePage } from './BasePage';

export class DashboardPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async goto() {
    await this.gotoPath('/dashboard');
  }

  get newEnrollmentButton(): Locator {
    return this.page.getByRole('button', { name: /nueva matrícula/i });
  }

  get enrollmentWizard(): Locator {
    return this.page.getByRole('dialog');
  }

  async openNewEnrollment() {
    await this.openNewEnrollmentWizard();
  }

  async openNewEnrollmentWizard() {
    await this.newEnrollmentButton.click();
    await expect(this.dialog.getByRole('heading', { name: 'Nueva matrícula' })).toBeVisible();
  }
}
