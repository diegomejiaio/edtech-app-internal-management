/**
 * Environment configuration for Espacio Pro v1.
 *
 * All values come from NEXT_PUBLIC_* env vars (required by Next.js static export).
 * See frontend/.env.example and docs/02-architecture.md §9.
 */

export const env = {
  apiUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:7071',
  apiVersion: process.env.NEXT_PUBLIC_API_VERSION || 'v1',
  clerkPublishableKey: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || '',
  clerkOrgId: process.env.NEXT_PUBLIC_CLERK_ORG_ID || '',
  isDev: process.env.NODE_ENV === 'development',
} as const;
