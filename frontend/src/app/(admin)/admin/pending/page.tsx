'use client'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { ExternalLink, Info, Users } from 'lucide-react'
import { FadeIn } from '@/components/motion'
import { formatLocalDateOnly } from '@/lib/dates'

interface PendingUser {
  id: string
  email: string
  name: string
  createdAt: string
}

// Mock data - in production this would come from Clerk API
const mockUsers: PendingUser[] = [
  { id: '1', email: 'juan@empresa.com', name: 'Juan Pérez', createdAt: '2024-12-24' },
  { id: '2', email: 'maria@consultores.pe', name: 'María García', createdAt: '2024-12-23' },
]

export default function PendingUsersPage() {
  const openClerkDashboard = () => {
    window.open('https://dashboard.clerk.com', '_blank')
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <FadeIn>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Usuarios Pendientes</h1>
            <p className="text-muted-foreground">
              Usuarios registrados sin organización asignada
            </p>
          </div>
          <Button variant="outline" onClick={openClerkDashboard}>
            <ExternalLink className="mr-2 h-4 w-4" />
            Abrir Clerk Dashboard
          </Button>
        </div>
      </FadeIn>

      {/* Info Alert */}
      <FadeIn delay={0.1}>
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Gestión de usuarios en Clerk</AlertTitle>
          <AlertDescription>
            La asignación de usuarios a organizaciones se realiza directamente en el 
            Dashboard de Clerk. Usa el botón &quot;Abrir Clerk Dashboard&quot; para acceder.
          </AlertDescription>
        </Alert>
      </FadeIn>

      {/* Users Table */}
      <FadeIn delay={0.2}>
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-muted-foreground" />
              <div>
                <CardTitle className="flex items-center gap-2">
                  Usuarios sin Organización
                  <Badge variant="secondary">{mockUsers.length}</Badge>
                </CardTitle>
                <CardDescription>
                  Estos usuarios necesitan ser invitados a una organización
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {mockUsers.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                No hay usuarios pendientes
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Fecha de Registro</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mockUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.name}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        {formatLocalDateOnly(user.createdAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline" onClick={openClerkDashboard}>
                          <ExternalLink className="mr-2 h-4 w-4" />
                          Invitar a Org
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </FadeIn>

      {/* Instructions */}
      <FadeIn delay={0.3}>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">¿Cómo asignar un usuario?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>1. Abre el Dashboard de Clerk</p>
            <p>2. Ve a &quot;Organizations&quot; y selecciona la organización destino</p>
            <p>3. En la pestaña &quot;Members&quot;, haz clic en &quot;Invite member&quot;</p>
            <p>4. Ingresa el email del usuario y selecciona su rol (admin o member)</p>
            <p>5. El usuario recibirá un email de invitación</p>
          </CardContent>
        </Card>
      </FadeIn>
    </div>
  )
}

