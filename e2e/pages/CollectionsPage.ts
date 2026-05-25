import type { Locator, Page } from '@playwright/test';
import { BasePage } from './BasePage';

export class CollectionsPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async goto() {
    await this.page.goto('/collections');
    await this.waitForLoaded();
  }

  get placeholderTitle(): Locator {
    return this.page.getByText('Próximamente');
  }
}
