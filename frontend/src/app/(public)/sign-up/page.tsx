'use client'

/**
 * Sign Up Page
 * 
 * - DEV_MODE=true: Shows message that registration is disabled in dev
 * - DEV_MODE=false: Dynamically loads Clerk's SignUp component
 */

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Logo } from '@/components/logo'
import { DEV_MODE, env } from '@/lib/env'

/**
 * Dev Mode Sign Up - Disabled in dev mode
 */
function DevSignUp() {
    const router = useRouter()

    return (
        <Card className="w-full max-w-md">
            <CardHeader className="text-center">
                <div className="flex justify-center mb-4">
                    <Logo className="h-10 w-auto" />
                </div>
                <CardTitle>Modo Desarrollo</CardTitle>
                <CardDescription>
                    El registro está deshabilitado en modo desarrollo
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground text-center">
                    En DEV_MODE, usa el usuario de desarrollo predefinido.
                </p>
                <Button onClick={() => router.push('/sign-in')} className="w-full">
                    Ir a Sign In
                </Button>
            </CardContent>
        </Card>
    )
}

/**
 * Production Sign Up - Clerk authentication (dynamically loaded)
 */
function ClerkSignUp() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [SignUpComponent, setSignUpComponent] = useState<React.ComponentType<any> | null>(null)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (!env.clerkPublishableKey) {
            setError('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY no está configurado')
            return
        }

        import('@clerk/clerk-react')
            .then((clerk) => {
                setSignUpComponent(() => clerk.SignUp)
            })
            .catch((err) => {
                console.error('Error loading Clerk:', err)
                setError('Error al cargar Clerk')
            })
    }, [])

    if (error) {
        return (
            <Card className="w-full max-w-md">
                <CardHeader className="text-center">
                    <CardTitle className="text-destructive">Error de Configuración</CardTitle>
                    <CardDescription>{error}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="bg-muted p-4 rounded-lg text-sm font-mono">
                        <p className="mb-2">Configura en .env.local:</p>
                        <code className="block">NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...</code>
                    </div>
                    <Link href="/sign-in">
                        <Button variant="outline" className="w-full">
                            Volver a Sign In
                        </Button>
                    </Link>
                </CardContent>
            </Card>
        )
    }

    if (!SignUpComponent) {
        return (
            <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
        )
    }

    return (
        <SignUpComponent
            routing="hash"
            signInUrl="/sign-in"
            fallbackRedirectUrl="/companies"
            appearance={{
                elements: {
                    card: 'shadow-none border rounded-lg',
                    formButtonPrimary: 'bg-primary hover:bg-primary/90',
                },
            }}
        />
    )
}

export default function SignUpPage() {
    return (
        <div className="flex min-h-screen items-center justify-center p-4">
            {DEV_MODE ? <DevSignUp /> : <ClerkSignUp />}
        </div>
    )
}
