"use client";

/**
 * Sign In Page — renders Clerk's SignIn component.
 * ClerkProvider is already mounted at the layout level.
 */

import { SignIn } from "@clerk/clerk-react";
import { Logo } from "@/components/logo";

export default function SignInPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-4">
      <Logo className="h-14 w-auto" />
      <SignIn
        routing="hash"
        signUpUrl="/sign-up"
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
