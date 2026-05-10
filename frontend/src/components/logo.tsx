"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

interface LogoProps {
  className?: string;
  variant?: "full" | "icon";
  /** When provided, renders the tenant logo instead of the Clearbook isotipo */
  tenantLogoUrl?: string;
  /** Alt text for the tenant logo */
  tenantName?: string;
}

const LOGO_VARIANTS = {
  hidden: { opacity: 0, scale: 0.85 },
  visible: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.85 },
};

const LOGO_TRANSITION = { duration: 0.25, ease: [0.25, 0.4, 0.25, 1] as const };

export function Logo({
  className = "",
  variant = "full",
  tenantLogoUrl,
  tenantName,
}: LogoProps) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = resolvedTheme === "dark";

  if (variant === "icon") {
    return (
      // AnimatePresence wraps the entire mounted/unmounted lifecycle:
      // - initial={false} removed so the first appearance animates in
      // - mode="wait" ensures exit finishes before next enter starts
      <AnimatePresence mode="wait">
        {mounted ? (
          tenantLogoUrl ? (
            <motion.img
              key="tenant-logo"
              src={tenantLogoUrl}
              alt={tenantName ?? "Logo"}
              className={className}
              style={{ objectFit: "contain" }}
              variants={LOGO_VARIANTS}
              initial="hidden"
              animate="visible"
              exit="exit"
              transition={LOGO_TRANSITION}
            />
          ) : (
            <motion.img
              key="merki-isotipo"
              src={isDark ? "/isotipo-light.svg" : "/isotipo-dark.svg"}
              alt="M"
              className={className}
              variants={LOGO_VARIANTS}
              initial="hidden"
              animate="visible"
              exit="exit"
              transition={LOGO_TRANSITION}
            />
          )
        ) : (
          // Placeholder mantiene el espacio mientras hidrata — no anima
          <div key="placeholder" className={className} />
        )}
      </AnimatePresence>
    );
  }

  return (
    <img
      src={isDark ? "/logo-light.svg" : "/logo-dark.svg"}
      alt="Clearbook"
      className={className}
    />
  );
}
