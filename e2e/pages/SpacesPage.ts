import type { Page } from '@playwright/test';
import { BasePage } from './BasePage';

export class SpacesPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async goto() {
    await this.page.goto('/spaces');
    await this.waitForLoaded();
  }

  get emptyState() {
    return this.page.getByText(/no hay espacios/i);
  }

  async clickNew() {
    await this.page.getByRole('button', { name: /nuevo espacio|\+/i }).click();
  }

  async fillAndSubmit(name: string) {
    await this.page.getByLabel(/nombre|name/i).fill(name);
    await this.page.getByRole('button', { name: /guardar|crear/i }).click();
  }
}
