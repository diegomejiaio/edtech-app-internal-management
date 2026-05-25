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
      .toMatch(/rgba?\([^)]*,\s*0(\.0+)?\)$|^transparent$|^rgb\(0, 0, 0\)$/);
  }

  async expectLabelInputGap(labelText: string | RegExp) {
    const label = this.dialog.getByText(labelText, { exact: typeof labelText === 'string' });
    await expect(label.first()).toBeVisible();
    const gap = await label.first().evaluate((node) => {
      let wrapper: HTMLElement | null = node as HTMLElement;
      let hasClass = false;
      for (let i = 0; i < 4 && wrapper; i++) {
        if (wrapper.classList && wrapper.classList.contains('space-y-2')) {
          hasClass = true;
          break;
        }
        wrapper = wrapper.parentElement;
      }
      const inputContainer = (node.parentElement ?? node) as HTMLElement;
      const input = inputContainer.querySelector('input,button,textarea,[role="combobox"]');
      const labelBottom = node.getBoundingClientRect().bottom;
      const inputTop = input ? input.getBoundingClientRect().top : labelBottom;
      return { hasClass, margin: inputTop - labelBottom };
    });
    expect(gap.hasClass || gap.margin > 0).toBeTruthy();
  }
}
