"use client";

import Link from "next/link";
import { Home, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";
import { FadeIn } from "@/components/motion";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <FadeIn>
        <div className="flex flex-col items-center space-y-6 text-center">
          <Logo className="mb-4 h-20 w-auto" />

          <div className="space-y-2">
            <h1 className="text-7xl font-bold text-primary">404</h1>
            <h2 className="text-2xl font-semibold text-foreground">
              Página no encontrada
            </h2>
            <p className="max-w-md text-muted-foreground">
              Lo sentimos, la página que buscas no existe o ha sido movida.
            </p>
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Button variant="outline" onClick={() => window.history.back()}>
              <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
              Volver
            </Button>
            <Button asChild>
              <Link href="/">
                <Home className="mr-2 h-4 w-4" aria-hidden="true" />
                Ir al inicio
              </Link>
            </Button>
          </div>
        </div>
      </FadeIn>
    </div>
  );
}
