import { expect, type Locator, type Page } from '@playwright/test';

export class BasePage {
  constructor(protected page: Page) {}

  async waitForLoaded() {
    await this.page.waitForLoadState('networkidle');
  }

  async gotoPath(path: string) {
    await this.page.goto(path);
    await this.waitForLoaded();
  }

  get table() {
    return this.page.locator('table');
  }

  get rows() {
    return this.page.locator('table tbody tr');
  }

  get dialog() {
    return this.page.getByRole('dialog');
  }

  async getSidebarLinks() {
    return this.page.locator('nav a').allTextContents();
  }

  async openFirstRowAction(actionName: RegExp | string) {
    await expect(this.rows.first()).toBeVisible();
    await this.rows.first().getByRole('button', { name: actionName }).click();
  }

  async selectFirstComboboxOption(scope: Locator, comboIndex = 0) {
    await scope.getByRole('combobox').nth(comboIndex).click();
    const options = this.page.getByRole('option').filter({ hasNotText: /sin opciones/i });
    await expect(options.first()).toBeVisible();
    await options.first().click();
  }

  async selectFirstCommandItem(scope: Locator, comboIndex = 0): Promise<boolean> {
    await scope.getByRole('combobox').nth(comboIndex).click();
    const empty = this.page.getByText('Sin resultados');
    if (await empty.isVisible().catch(() => false)) return false;
    const item = this.page.locator('[cmdk-item]').first();
    await expect(item).toBeVisible();
    await item.click();
    return true;
  }

  async confirmDelete() {
    await this.page.getByRole('alertdialog').getByRole('button', { name: /^Eliminar$/ }).click();
  }

  async expectRowsNotFlashingOnLoad() {
    await expect(this.rows.first()).toBeVisible();
    await expect
      .poll(async () => this.rows.first().evaluate((row) => getComputedStyle(row).backgroundColor), {
        timeout: 2_000,
      })
      .toMatch(/rgba\(0, 0, 0, 0\)|transparent/);
  }

  async expectLabelInputGap(labelText: string | RegExp) {
    const label = this.dialog.getByText(labelText, { exact: typeof labelText === 'string' });
    await expect(label.first()).toBeVisible();
    const gap = await label.first().evaluate((node) => {
      const wrapper = node.parentElement;
      const input = wrapper?.querySelector('input,button,textarea,[role="combobox"]');
      if (!wrapper || !input) return { hasClass: false, margin: 0 };
      const labelBottom = node.getBoundingClientRect().bottom;
      const inputTop = input.getBoundingClientRect().top;
      return {
        hasClass: wrapper.classList.contains('space-y-2'),
        margin: inputTop - labelBottom,
      };
    });
    expect(gap.hasClass || gap.margin > 0).toBeTruthy();
  }
}
