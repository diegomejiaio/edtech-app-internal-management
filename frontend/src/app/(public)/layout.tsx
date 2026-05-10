"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuthContext } from "@/providers/auth-provider";
import { DEV_MODE } from "@/lib/env";

/**
 * Public layout - for sign-in / sign-up / select-org pages.
 *
 * If a signed-in user lands on a public auth page, bounce them to /companies.
 * `/waiting` is excluded because it intentionally renders for signed-in users
 * that have no tenant linked yet.
 */

const BOUNCE_WHEN_SIGNED_IN = ["/sign-in", "/sign-up", "/select-org"];

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { isLoaded, isSignedIn } = useAuthContext();

  useEffect(() => {
    if (DEV_MODE) return;
    if (!isLoaded || !isSignedIn) return;
    const shouldBounce = BOUNCE_WHEN_SIGNED_IN.some(
      (p) => pathname === p || pathname.startsWith(`${p}/`),
    );
    if (shouldBounce) {
      router.replace("/companies");
    }
  }, [isLoaded, isSignedIn, pathname, router]);

  return <>{children}</>;
}
