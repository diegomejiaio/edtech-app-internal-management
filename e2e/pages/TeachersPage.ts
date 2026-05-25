import type { Page } from '@playwright/test';
import { BasePage } from './BasePage';

export class TeachersPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async goto() {
    await this.gotoPath('/teachers');
  }

  async search(term: string) {
    await this.page.getByPlaceholder('Buscar por nombre, documento o teléfono...').fill(term);
  }

  async clickNewTeacher() {
    await this.page.getByRole('button', { name: /nuevo profesor/i }).click();
  }

  async createTeacher(data: {
    firstName: string;
    lastName: string;
    docNumber: string;
    phone?: string;
    email?: string;
    specialty?: string;
  }) {
    await this.clickNewTeacher();
    await this.dialog.getByLabel('Nombre').fill(data.firstName);
    await this.dialog.getByLabel('Apellido').fill(data.lastName);
    await this.dialog.getByLabel('N° Documento').fill(data.docNumber);
    if (data.phone) await this.dialog.getByLabel('Teléfono').fill(data.phone);
    if (data.email) await this.dialog.getByLabel('Email').fill(data.email);
    if (data.specialty) await this.dialog.getByLabel('Especialidad').fill(data.specialty);
    await this.dialog.getByRole('button', { name: 'Guardar' }).click();
  }
}
