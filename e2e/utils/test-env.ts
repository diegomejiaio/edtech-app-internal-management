import fs from 'fs';
import path from 'path';

function hasUsableStorageState(): boolean {
  const authFile = path.join(process.cwd(), 'fixtures/.auth/user.json');
  if (!fs.existsSync(authFile)) return false;

  try {
    const state = JSON.parse(fs.readFileSync(authFile, 'utf-8')) as {
      cookies?: unknown[];
      origins?: unknown[];
    };
    return Boolean(state.cookies?.length || state.origins?.length);
  } catch {
    return false;
  }
}

export function hasAuthConfig(): boolean {
  return Boolean(process.env.TEST_USER_EMAIL && process.env.TEST_USER_PASSWORD) || hasUsableStorageState();
}

export const authRequiredMessage =
  'Requires e2e/.env with TEST_USER_EMAIL and TEST_USER_PASSWORD, or a valid existing auth storage state.';
