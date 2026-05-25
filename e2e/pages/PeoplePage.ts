import type { Locator, Page } from '@playwright/test';
import { BasePage } from './BasePage';

export class PeoplePage extends BasePage {
  constructor(page: Page, private readonly path: string) {
    super(page);
  }

  async goto() {
    await this.page.goto(this.path);
    await this.waitForLoaded();
  }

  get searchInput(): Locator {
    return this.page.getByPlaceholder('Buscar por nombre, documento o teléfono...');
  }
}
