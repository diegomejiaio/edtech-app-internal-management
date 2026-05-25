import type { Page } from '@playwright/test';
import { BasePage } from './BasePage';

export class StudentSourcesPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async goto() {
    await this.page.goto('/student-sources');
    await this.waitForLoaded();
  }

  get items() {
    return this.page.locator('[data-testid="catalog-item"], .badge, [class*="Card"]').first().locator('..');
  }

  get badges() {
    return this.page.getByRole('status').or(this.page.locator('.inline-flex'));
  }

  async clickNew() {
    await this.page.getByRole('button', { name: /nueva|agregar|\+/i }).click();
  }

  async fillAndSubmit(value: string) {
    await this.page.getByLabel(/valor|nombre|value/i).fill(value);
    await this.page.getByRole('button', { name: /guardar|agregar|crear/i }).click();
  }

  async disableItem(value: string) {
    const item = this.page.getByText(value).locator('..');
    await item.getByRole('button', { name: /deshabilitar|eliminar|desactivar/i }).click();
  }
}
