import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';

dotenv.config();

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // Limit concurrency to avoid overwhelming the dev Function App / Cosmos tier,
  // which causes spurious blank-page renders when many parallel workers compete
  // for the same backend. Override locally with `PW_WORKERS=N pnpm test`.
  workers: process.env.CI ? 1 : Number(process.env.PW_WORKERS ?? 3),
  reporter: [
    ['html', { open: 'never' }],
    ['list'],
  ],
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
  },
  projects: [
    // Auth setup (runs first, saves state)
    { name: 'setup', testMatch: /.*\.setup\.ts/ },
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'fixtures/.auth/user.json',
      },
      dependencies: ['setup'],
    },
    {
      name: 'mobile',
      use: {
        ...devices['iPhone 14'],
        storageState: 'fixtures/.auth/user.json',
      },
      dependencies: ['setup'],
    },
  ],
});
