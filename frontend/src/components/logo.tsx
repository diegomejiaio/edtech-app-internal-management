"use client";

/**
 * Espacio Pro logo with icon and full variants.
 */

import Image from "next/image";
import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  variant?: "icon" | "full";
  tone?: "default" | "inverted";
}

export function Logo({
  className,
  variant = "full",
  tone = "inverted",
}: LogoProps) {
  if (variant === "icon") {
    return (
      <Image
        src={
          tone === "inverted" ? "/brand/app/icon-white.png" : "/brand/app/icon.png"
        }
        alt="Espacio Pro"
        width={48}
        height={48}
        priority
        className={cn(
          "inline-block h-8 w-8 object-contain",
          className,
        )}
      />
    );
  }

  return (
    <Image
      src={
        tone === "inverted" ? "/brand/app/logo-white.png" : "/brand/app/logo.png"
      }
      alt="Espacio Pro"
      width={240}
      height={96}
      priority
      className={cn("inline-block h-10 w-auto object-contain", className)}
    />
  );
}
