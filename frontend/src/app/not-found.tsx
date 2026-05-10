'use client'

import Link from 'next/link'
import { Home, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Logo } from '@/components/logo'
import { FadeIn } from '@/components/motion'

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <FadeIn>
        <div className="flex flex-col items-center text-center space-y-6">
        {/* Logo */}
        <Logo className="h-20 w-auto mb-4" />
        
        {/* 404 */}
        <div className="space-y-2">
          <h1 className="text-7xl font-bold text-primary">404</h1>
          <h2 className="text-2xl font-semibold text-foreground">
            Página no encontrada
          </h2>
          <p className="text-muted-foreground max-w-md">
            Lo sentimos, la página que buscas no existe o ha sido movida.
          </p>
        </div>
        
        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 mt-6">
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
  )
}
