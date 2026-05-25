import type { Page } from '@playwright/test';
import { BasePage } from './BasePage';

export class StudentsPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async goto() {
    await this.gotoPath('/students');
  }

  async search(term: string) {
    await this.page.getByPlaceholder('Buscar por nombre, documento o teléfono...').fill(term);
  }

  async clickNewStudent() {
    await this.page.getByRole('button', { name: /nuevo alumno/i }).click();
  }

  async createStudent(data: {
    firstName: string;
    lastName: string;
    docNumber: string;
    phone?: string;
    email?: string;
  }) {
    await this.clickNewStudent();
    await this.dialog.getByLabel('Nombre').fill(data.firstName);
    await this.dialog.getByLabel('Apellido').fill(data.lastName);
    await this.dialog.getByLabel('N° Documento').fill(data.docNumber);
    if (data.phone) await this.dialog.getByLabel('Teléfono').fill(data.phone);
    if (data.email) await this.dialog.getByLabel('Email').fill(data.email);
    await this.dialog.getByRole('button', { name: 'Guardar' }).click();
    await this.dialog.waitFor({ state: 'hidden' });
  }
}
