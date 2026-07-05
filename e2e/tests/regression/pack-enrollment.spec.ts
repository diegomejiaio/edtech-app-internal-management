import { expect, test } from '@playwright/test';
import { DashboardPage } from '../../pages/DashboardPage';
import { mockEspacioProApi, mockSchedule } from '../../utils/api-mocks';

/**
 * Pack enrollment (Básico + Avanzado) — frontend orchestration.
 *
 * The wizard's pack mode creates TWO independent enrollments and splits a
 * single "total recibido" into TWO independent payments (never one payment
 * with two enrollment ids). Traceability is a default "Pack" note on each
 * payment. These tests assert that orchestration against captured POST bodies,
 * plus the "restante por asignar" guardrail that blocks a mismatched split.
 *
 * Fully mocked: no backend / Cosmos required.
 */

const auditUser = {
  clerkUserId: 'e2e-user',
  email: 'e2e@example.com',
  displayName: 'E2E User',
};

const baseEntity = {
  active: true,
  createdAt: '2026-05-01T00:00:00.000Z',
  createdBy: auditUser,
  updatedAt: '2026-05-01T00:00:00.000Z',
  updatedBy: auditUser,
  deletedAt: null,
  deletedBy: null,
};

const scheduleBasico = {
  ...baseEntity,
  ...mockSchedule,
  id: 'sch-basico',
  level: 'Básico',
  price: 400,
};

const scheduleAvanzado = {
  ...baseEntity,
  ...mockSchedule,
  id: 'sch-avanzado',
  level: 'Avanzado',
  price: 500,
  _etag: 'schedule-avanzado-etag',
};

function paginated<T>(items: T[]) {
  return { items, total: items.length, limit: 50, offset: 0 };
}

interface Captured {
  enrollments: Array<Record<string, unknown>>;
  payments: Array<Record<string, unknown>>;
}

/**
 * Layers pack-specific routes on top of the shared mock:
 *  - the schedule list returns TWO schedules (Básico + Avanzado) for the pickers,
 *  - any `/schedules/{id}/dashboard` returns a valid payload (keeps the dashboard
 *    from crashing on the second, otherwise-unknown schedule id),
 *  - POST /enrollments and POST /student-payments are captured and echoed back
 *    with a generated id; GETs fall through to the shared mock.
 */
async function mockPackApi(page: import('@playwright/test').Page): Promise<Captured> {
  const captured: Captured = { enrollments: [], payments: [] };

  await mockEspacioProApi(page);

  // Single-catalog fetch (`GET /catalogs/{code}`) — the shared mock only serves
  // the `/catalogs` list, so CatalogSelect (payment method) needs this.
  await page.route('**/api/v1/catalogs/*', async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    const url = new URL(route.request().url());
    const code = decodeURIComponent(url.pathname.split('/').pop() ?? '');
    const items = code === 'paymentMethods'
      ? [
          { value: 'Yape', order: 1, active: true },
          { value: 'Transferencia', order: 2, active: true },
          { value: 'Efectivo', order: 3, active: true },
        ]
      : code === 'studentSources'
        ? [{ value: 'Referido', order: 1, active: true }]
        : [];
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ...baseEntity, id: `catalog-${code}`, type: 'catalog', code, items }),
    });
  });

  // Generic dashboard payload for any schedule id (protects the dashboard grid).
  await page.route('**/api/v1/schedules/*/dashboard', async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        schedule: scheduleBasico,
        month: '2026-05',
        enrollments: [],
        summary: {
          enrolled: 0, paid: 0, debtors: 0, occupancyPct: 0,
          sessions: 0, completedSessions: 0, pendingSessions: 0,
          expectedAmount: 0, paidAmount: 0, pendingAmount: 0,
        },
      }),
    });
  });

  // Schedule LIST → two schedules for the pack pickers.
  await page.route('**/api/v1/schedules**', async (route) => {
    const url = new URL(route.request().url());
    const isList = url.pathname.replace(/^\/api\/v1/, '') === '/schedules';
    if (route.request().method() !== 'GET' || !isList) return route.fallback();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(paginated([scheduleBasico, scheduleAvanzado])),
    });
  });

  // Capture enrollment creates; echo back with a deterministic id.
  await page.route('**/api/v1/enrollments**', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    const body = route.request().postDataJSON() as Record<string, unknown>;
    captured.enrollments.push(body);
    const id = `enr-${captured.enrollments.length}`;
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({ ...baseEntity, ...body, id, type: 'enrollment', _etag: id }),
    });
  });

  // Capture payment creates; echo back with a deterministic id.
  await page.route('**/api/v1/student-payments**', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    const body = route.request().postDataJSON() as Record<string, unknown>;
    captured.payments.push(body);
    const id = `pay-${captured.payments.length}`;
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({ ...baseEntity, ...body, id, type: 'studentPayment', _etag: id }),
    });
  });

  return captured;
}

test.describe('Pack enrollment @session-features', () => {
  test('creates two enrollments and a split payment with Pack notes', async ({ page }) => {
    const captured = await mockPackApi(page);
    const dashboard = new DashboardPage(page);

    await dashboard.goto();
    await dashboard.openNewEnrollmentWizard();
    const dialog = dashboard.dialog;

    // Enable pack mode.
    await dialog.locator('#packMode').click();
    await expect(dialog.getByText('Matrícula en pack: Básico + Avanzado')).toBeVisible();

    const comboboxes = dialog.getByRole('combobox');

    // Student (combobox 0).
    await comboboxes.nth(0).click();
    await page.locator('[cmdk-item]').first().click();

    // Horario 1 · Básico (combobox 1).
    await comboboxes.nth(1).click();
    await page.getByRole('option', { name: /Básico/ }).first().click();

    // Horario 2 · Avanzado (combobox 2).
    await comboboxes.nth(2).click();
    await page.getByRole('option', { name: /Avanzado/ }).first().click();

    // Prices should auto-fill from each schedule's list price.
    await expect(dialog.locator('#enrollmentPrice')).toHaveValue('400');
    await expect(dialog.locator('#enrollmentPrice2')).toHaveValue('500');

    // Split: 150 = 100 (Básico) + 50 (Avanzado).
    await dialog.locator('#totalReceived').fill('150');
    await dialog.locator('#amountBasico').fill('100');
    await dialog.locator('#amountAvanzado').fill('50');
    await expect(dialog.getByText('Distribución completa ✓')).toBeVisible();

    // Payment method (Radix Select — combobox 3).
    await comboboxes.nth(3).click();
    await page.getByRole('option', { name: 'Yape' }).click();

    await dialog.getByRole('button', { name: 'Matricular pack' }).click();

    // Two enrollments, mapped to the two schedules with their negotiated prices.
    await expect.poll(() => captured.enrollments.length).toBe(2);
    expect(captured.enrollments[0].scheduleId).toBe('sch-basico');
    expect(captured.enrollments[0].schedulePrice).toBe(400);
    expect(captured.enrollments[1].scheduleId).toBe('sch-avanzado');
    expect(captured.enrollments[1].schedulePrice).toBe(500);

    // Two payments: 100 → enr-1, 50 → enr-2, both stamped "Pack".
    await expect.poll(() => captured.payments.length).toBe(2);
    expect(captured.payments[0]).toMatchObject({ enrollmentId: 'enr-1', amount: 100, notes: 'Pack' });
    expect(captured.payments[1]).toMatchObject({ enrollmentId: 'enr-2', amount: 50, notes: 'Pack' });

    // Wizard closes on success.
    await expect(dialog).toBeHidden();
  });

  test('blocks submit when the split does not match the total received', async ({ page }) => {
    const captured = await mockPackApi(page);
    const dashboard = new DashboardPage(page);

    await dashboard.goto();
    await dashboard.openNewEnrollmentWizard();
    const dialog = dashboard.dialog;

    await dialog.locator('#packMode').click();
    const comboboxes = dialog.getByRole('combobox');

    await comboboxes.nth(0).click();
    await page.locator('[cmdk-item]').first().click();
    await comboboxes.nth(1).click();
    await page.getByRole('option', { name: /Básico/ }).first().click();
    await comboboxes.nth(2).click();
    await page.getByRole('option', { name: /Avanzado/ }).first().click();

    // 150 total but only 140 distributed → 10 unassigned.
    await dialog.locator('#totalReceived').fill('150');
    await dialog.locator('#amountBasico').fill('100');
    await dialog.locator('#amountAvanzado').fill('40');
    await expect(dialog.getByText(/Restante por asignar: S\/ 10\.00/)).toBeVisible();

    // Select a payment method so the guard under test is the distribution one.
    await comboboxes.nth(3).click();
    await page.getByRole('option', { name: 'Yape' }).click();

    await dialog.getByRole('button', { name: 'Matricular pack' }).click();

    // Nothing is created and the wizard stays open.
    await expect(page.getByText(/no cuadra con el total recibido/i)).toBeVisible();
    expect(captured.enrollments).toHaveLength(0);
    expect(captured.payments).toHaveLength(0);
    await expect(dialog).toBeVisible();
  });
});
