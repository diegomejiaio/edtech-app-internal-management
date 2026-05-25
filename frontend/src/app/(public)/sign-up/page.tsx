"use client";

/**
 * Sign Up Page — renders Clerk's SignUp component.
 * ClerkProvider is already mounted at the layout level.
 */

import { SignUp } from "@clerk/clerk-react";
import { Logo } from "@/components/logo";

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-4">
      <Logo className="h-14 w-auto" />
      <SignUp
        routing="hash"
        signInUrl="/sign-in"
        fallbackRedirectUrl="/dashboard"
        appearance={{
          elements: {
            card: "shadow-none border rounded-lg",
            formButtonPrimary: "bg-primary hover:bg-primary/90",
          },
        }}
      />
    </div>
  );
}
