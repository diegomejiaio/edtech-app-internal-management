'use client'

/**
 * Sign In Page
 * 
 * - DEV_MODE=true: Shows mock sign-in that redirects to app
 * - DEV_MODE=false: Dynamically loads Clerk's SignIn component
 */

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Logo } from '@/components/logo'
import { DEV_MODE, DEV_DEFAULTS, env } from '@/lib/env'

/**
 * Dev Mode Sign In - Mock authentication
 */
function DevSignIn() {
    const router = useRouter()

    const handleDevSignIn = () => {
        router.push('/companies')
    }

    return (
        <Card className="w-full max-w-md">
            <CardHeader className="text-center">
                <div className="flex justify-center mb-4">
                    <Logo className="h-10 w-auto" />
                </div>
                <CardTitle>Modo Desarrollo</CardTitle>
                <CardDescription>
                    Autenticación simulada - DEV_MODE activo
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="bg-muted p-4 rounded-lg text-sm">
                    <p className="font-medium mb-2">Usuario de desarrollo:</p>
                    <ul className="space-y-1 text-muted-foreground">
                        <li>• ID: {DEV_DEFAULTS.userId}</li>
                        <li>• Email: {DEV_DEFAULTS.userEmail}</li>
                        <li>• Rol: {DEV_DEFAULTS.userRole}</li>
                        <li>• Tenant: {DEV_DEFAULTS.tenantId}</li>
                    </ul>
                </div>
                <Button onClick={handleDevSignIn} className="w-full">
                    Entrar como Dev User
                </Button>
            </CardContent>
        </Card>
    )
}

/**
 * Production Sign In - Clerk authentication (dynamically loaded)
 */
function ClerkSignIn() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [SignInComponent, setSignInComponent] = useState<React.ComponentType<any> | null>(null)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (!env.clerkPublishableKey) {
            setError('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY no está configurado')
            return
        }

        import('@clerk/clerk-react')
            .then((clerk) => {
                setSignInComponent(() => clerk.SignIn)
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
                <CardContent>
                    <div className="bg-muted p-4 rounded-lg text-sm font-mono">
                        <p className="mb-2">Configura en .env.local:</p>
                        <code className="block">NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...</code>
                    </div>
                </CardContent>
            </Card>
        )
    }

    if (!SignInComponent) {
        return (
            <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
        )
    }

    return (
        <SignInComponent
            routing="hash"
            signUpUrl="/sign-up"
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

export default function SignInPage() {
    return (
        <div className="flex min-h-screen items-center justify-center p-4">
            {DEV_MODE ? <DevSignIn /> : <ClerkSignIn />}
        </div>
    )
}
