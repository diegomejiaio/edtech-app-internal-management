/**
 * Centralized site configuration.
 *
 * `PUBLIC_APP_URL` is injected by Astro at build time from `.env.{mode}`.
 * Falls back to production URL if the env var is not set.
 */
const APP_URL = (
  import.meta.env.PUBLIC_APP_URL ?? "https://app.clear-book.com"
).replace(/\/$/, "");

/**
 * Build a fully-qualified URL pointing to the Clearbook app.
 *
 * @example
 *   appUrl("/sign-in") // → "https://app.clear-book.com/sign-in"
 *   appUrl("sign-up")  // → "https://app.clear-book.com/sign-up"
 */
export function appUrl(path: string = "/"): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${APP_URL}${normalized}`;
}

export const SITE = {
  appUrl: APP_URL,
} as const;
