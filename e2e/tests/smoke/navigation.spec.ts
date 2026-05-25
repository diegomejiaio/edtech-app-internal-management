import { test, expect, type Page } from '@playwright/test';

// Shadcn `<Sidebar>` is collapsed behind a Sheet on mobile viewports.
// Open it via the hamburger before clicking nav links.
async function openSidebarIfCollapsed(page: Page) {
  const dashboardHeading = page.getByRole('heading', { name: 'Dashboard', level: 1 });
  await expect(dashboardHeading).toBeVisible();
  const hamburger = page.getByRole('button', { name: /toggle navigation sidebar|abrir navegaci/i });
  if (await hamburger.isVisible().catch(() => false)) {
    const firstNavLink = page.getByRole('link', { name: /^dashboard$/i });
    if (!(await firstNavLink.isVisible().catch(() => false))) {
      await hamburger.click();
    }
  }
}

test.describe('Navigation @smoke', () => {
  test('should load dashboard after login', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/dashboard/);
    // Shadcn sidebar doesn't expose role="complementary"; check the dashboard
    // heading rendered (auth + layout shell ok) instead.
    await expect(page.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeVisible();
  });

  test('should navigate to students page', async ({ page }) => {
    await page.goto('/dashboard');
    await openSidebarIfCollapsed(page);
    await page.getByRole('link', { name: /^alumnos$/i }).click();
    await expect(page).toHaveURL(/students/);
  });

  test('should navigate to collections page', async ({ page }) => {
    await page.goto('/dashboard');
    await openSidebarIfCollapsed(page);
    await page.getByRole('link', { name: /^cobranzas$/i }).click();
    await expect(page).toHaveURL(/collections/);
  });
});
