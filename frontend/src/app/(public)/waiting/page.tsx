'use client'

/**
 * Waiting for Onboarding Page
 * 
 * Shown to users who have signed up but:
 * 1. Don't belong to any Clerk organization yet, OR
 * 2. Their Clerk org is not linked to a tenant in our database
 * 
 * They need to wait for a Master to create their tenant and invite them.
 */

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Logo } from '@/components/logo'
import { Mail, Phone, Clock, LogOut, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { DEV_MODE } from '@/lib/env'
import { useAuthContext } from '@/providers/auth-provider'
import { useCurrentTenant } from '@/hooks/use-tenants'

export default function WaitingPage() {
    const router = useRouter()
    const { orgId, isSignedIn, isLoaded } = useAuthContext()
    const [isRefreshing, setIsRefreshing] = useState(false)
    
    // Try to fetch tenant - if successful, user can access the app
    const { data: tenant, refetch, isLoading: isTenantLoading } = useCurrentTenant()

    // If user has a valid tenant, redirect to app
    useEffect(() => {
        if (tenant) {
            router.replace('/companies')
        }
    }, [tenant, router])

    // If in dev mode, redirect to app
    useEffect(() => {
        if (DEV_MODE) {
            router.replace('/companies')
        }
    }, [router])
    
    // Auto-refresh every 30 seconds to check if user was onboarded
    useEffect(() => {
        if (DEV_MODE || !isSignedIn) return
        
        const interval = setInterval(() => {
            refetch()
        }, 30000) // 30 seconds
        
        return () => clearInterval(interval)
    }, [isSignedIn, refetch])
    
    const handleRefresh = async () => {
        setIsRefreshing(true)
        await refetch()
        setIsRefreshing(false)
    }

    const handleSignOut = async () => {
        if (DEV_MODE) {
            router.push('/')
            return
        }
        
        try {
            const clerk = await import('@clerk/clerk-react')
            // Use signOut from clerk
            if (typeof window !== 'undefined' && (window as unknown as { Clerk?: { signOut: () => Promise<void> } }).Clerk) {
                await (window as unknown as { Clerk: { signOut: () => Promise<void> } }).Clerk.signOut()
            }
            window.location.href = '/sign-in'
        } catch {
            router.push('/sign-in')
        }
    }

    // Show loading if checking auth
    if (!DEV_MODE && (!isLoaded || isTenantLoading)) {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                <div className="text-muted-foreground text-sm">Verificando estado de tu cuenta...</div>
            </div>
        )
    }

    return (
        <div className="flex min-h-screen items-center justify-center p-4 bg-muted/40">
            <Card className="w-full max-w-lg">
                <CardHeader className="text-center space-y-4">
                    <div className="flex justify-center">
                        <Logo className="h-32 w-auto" />
                    </div>
                    <div className="space-y-2">
                        <CardTitle className="text-2xl">
                            🎉 ¡Gracias por registrarte!
                        </CardTitle>
                        <CardDescription className="text-base">
                            Hemos recibido tu solicitud correctamente.
                        </CardDescription>
                    </div>
                </CardHeader>
                
                <CardContent className="space-y-6">
                    {/* Main message */}
                    <div className="bg-muted rounded-lg p-4 space-y-3">
                        <div className="flex items-start gap-3">
                            <Clock className="h-5 w-5 text-muted-foreground mt-0.5" />
                            <p className="text-sm text-muted-foreground">
                                Nuestro equipo se pondrá en contacto contigo para ayudarte 
                                a completar la configuración de tu cuenta.
                            </p>
                        </div>
                        <div className="flex items-start gap-3">
                            <Mail className="h-5 w-5 text-muted-foreground mt-0.5" />
                            <p className="text-sm text-muted-foreground">
                                Revisa tu correo en los próximos días para más información.
                            </p>
                        </div>
                    </div>

                    {/* Contact info */}
                    <div className="border-t pt-4 space-y-3">
                        <p className="text-sm font-medium">¿Tienes preguntas?</p>
                        <div className="space-y-2">
                            <a 
                                href="https://wa.me/51999888777" 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                            >
                                <Phone className="h-4 w-4" />
                                WhatsApp: +51 999 888 777
                            </a>
                            <a 
                                href="mailto:soporte@clear-book.com"
                                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                            >
                                <Mail className="h-4 w-4" />
                                soporte@clear-book.com
                            </a>
                        </div>
                    </div>

                    {/* Sign out button */}
                    <div className="border-t pt-4 space-y-2">
                        <Button 
                            variant="default" 
                            className="w-full"
                            onClick={handleRefresh}
                            disabled={isRefreshing}
                        >
                            <RefreshCw className={cn("mr-2 h-4 w-4", isRefreshing && "animate-spin")} />
                            {isRefreshing ? 'Verificando...' : 'Verificar estado'}
                        </Button>
                        <Button 
                            variant="outline" 
                            className="w-full"
                            onClick={handleSignOut}
                        >
                            <LogOut className="mr-2 h-4 w-4" />
                            Cerrar sesión
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
