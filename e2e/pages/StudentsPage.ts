import type { Page } from '@playwright/test';
import { BasePage } from './BasePage';

export class StudentsPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async goto() {
    await this.page.goto('/dashboard/students');
    await this.waitForLoaded();
  }

  get table() {
    return this.page.locator('table');
  }

  get rows() {
    return this.page.locator('table tbody tr');
  }

  async search(term: string) {
    await this.page.getByPlaceholder(/buscar/i).fill(term);
  }

  async clickNewStudent() {
    await this.page.getByRole('button', { name: /nuevo/i }).click();
  }
}
