"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@clerk/clerk-react";

/**
 * Public layout — for sign-in / sign-up pages.
 *
 * If a signed-in user lands on a public auth page, bounce them to /dashboard.
 */

const BOUNCE_WHEN_SIGNED_IN = ["/sign-in", "/sign-up"];

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { isLoaded, isSignedIn } = useAuth();

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    const shouldBounce = BOUNCE_WHEN_SIGNED_IN.some(
      (p) => pathname === p || pathname.startsWith(`${p}/`),
    );
    if (shouldBounce) {
      router.replace("/dashboard");
    }
  }, [isLoaded, isSignedIn, pathname, router]);

  return <>{children}</>;
}
