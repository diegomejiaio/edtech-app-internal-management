import type { Page } from '@playwright/test';

export class BasePage {
  constructor(protected page: Page) {}

  async waitForLoaded() {
    await this.page.waitForLoadState('networkidle');
  }

  async getSidebarLinks() {
    return this.page.locator('nav a').allTextContents();
  }
}
