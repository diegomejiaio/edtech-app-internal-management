'use client';

/**
 * Sign Up Page — renders Clerk's SignUp component.
 * ClerkProvider is already mounted at the layout level.
 */

import { SignUp } from '@clerk/clerk-react';

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <SignUp
        routing="hash"
        signInUrl="/sign-in"
        fallbackRedirectUrl="/dashboard"
        appearance={{
          elements: {
            card: 'shadow-none border rounded-lg',
            formButtonPrimary: 'bg-primary hover:bg-primary/90',
          },
        }}
      />
    </div>
  );
}
