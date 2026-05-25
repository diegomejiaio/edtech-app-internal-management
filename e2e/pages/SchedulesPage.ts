import type { Page } from '@playwright/test';
import { BasePage } from './BasePage';

export class SchedulesPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async goto() {
    await this.gotoPath('/schedules');
  }

  async search(term: string) {
    await this.page.getByPlaceholder('Buscar por curso, nivel, profesor o días...').fill(term);
  }
}
