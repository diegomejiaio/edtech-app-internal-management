import { expect, type Page } from '@playwright/test';
import { BasePage } from './BasePage';

export class ExpensesPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async goto() {
    await this.gotoPath('/expenses');
  }

  async search(term: string) {
    await this.page.getByPlaceholder('Buscar por descripción, categoría u horario...').fill(term);
  }

  async openNewExpenseForm() {
    await this.page.getByRole('button', { name: /nuevo gasto/i }).click();
    await expect(this.dialog.getByRole('heading', { name: 'Nuevo gasto' })).toBeVisible();
  }
}
