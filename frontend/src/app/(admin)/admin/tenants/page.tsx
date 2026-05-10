'use client'

import { useState } from 'react'
import { Plus, RefreshCw, CheckCircle, XCircle, MoreHorizontal, Loader2, Pencil } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatLocalDateOnly } from '@/lib/dates'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FadeIn } from '@/components/motion'
import { useTenants, useCreateTenant, useActivateTenant, useSuspendTenant, useUpdateTenant } from '@/hooks/use-tenants'
import { cn } from '@/lib/utils'
import type { Tenant } from '@/types'

const statusConfig = {
  pending: { label: 'Pendiente', variant: 'secondary' as const, color: 'text-yellow-600' },
  active: { label: 'Activo', variant: 'default' as const, color: 'text-green-600' },
  suspended: { label: 'Suspendido', variant: 'destructive' as const, color: 'text-red-600' },
}

export default function TenantsPage() {
  const { data, isLoading, error, refetch } = useTenants()
  const tenants = data?.items ?? []

  return (
    <div className="space-y-6">
      {/* Header */}
      <FadeIn>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Tenants</h1>
            <p className="text-muted-foreground">
              Gestión de organizaciones (estudios contables)
            </p>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => refetch()}
              disabled={isLoading}
            >
              <RefreshCw className={cn("mr-2 h-4 w-4", isLoading && "animate-spin")} />
              Actualizar
            </Button>
            <CreateTenantDialog />
          </div>
        </div>
      </FadeIn>

      {/* Table */}
      <FadeIn delay={0.1}>
        <Card>
          <CardHeader>
            <CardTitle>Todas las Organizaciones</CardTitle>
            <CardDescription>
              {tenants.length} tenant{tenants.length !== 1 ? 's' : ''} registrado{tenants.length !== 1 ? 's' : ''}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error ? (
              <div className="py-8 text-center text-destructive">
                Error al cargar tenants: {error.message}
              </div>
            ) : isLoading ? (
              <div className="space-y-3 py-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <div className="flex-1">
                      <Skeleton className="h-4 w-40 mb-1" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                    <Skeleton className="h-6 w-20" />
                    <Skeleton className="h-4 w-16" />
                    <div>
                      <Skeleton className="h-4 w-28 mb-1" />
                      <Skeleton className="h-3 w-36" />
                    </div>
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-8 w-8" />
                  </div>
                ))}
              </div>
            ) : tenants.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                No hay tenants registrados
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Organización</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Contacto</TableHead>
                    <TableHead>Creado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tenants.map((tenant) => (
                    <TenantRow key={tenant.id} tenant={tenant} />
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </FadeIn>
    </div>
  )
}

function TenantRow({ tenant }: { tenant: Tenant }) {
  const activate = useActivateTenant()
  const suspend = useSuspendTenant()
  const [editOpen, setEditOpen] = useState(false)
  const status = statusConfig[tenant.status]

  const handleActivate = () => {
    activate.mutate(tenant.id)
  }

  const handleSuspend = () => {
    suspend.mutate(tenant.id)
  }

  return (
    <TableRow>
      <TableCell>
        <div>
          <p className="font-medium">{tenant.name}</p>
          <p className="text-xs text-muted-foreground">{tenant.id}</p>
        </div>
      </TableCell>
      <TableCell>
        <Badge variant={status.variant}>{status.label}</Badge>
      </TableCell>
      <TableCell className="capitalize">{tenant.plan || '—'}</TableCell>
      <TableCell>
        {tenant.contact ? (
          <div className="text-sm">
            <p>{tenant.contact.name}</p>
            <p className="text-muted-foreground">{tenant.contact.email}</p>
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell>
        {formatLocalDateOnly(tenant.created_at)}
      </TableCell>
      <TableCell className="text-right">
        <EditTenantDialog tenant={tenant} open={editOpen} onOpenChange={setEditOpen} />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <MoreHorizontal className="h-4 w-4" />
              <span className="sr-only">Acciones</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {tenant.status === 'pending' && (
              <DropdownMenuItem 
                onClick={handleActivate}
                disabled={activate.isPending}
              >
                <CheckCircle className="mr-2 h-4 w-4 text-green-500" />
                Activar
              </DropdownMenuItem>
            )}
            {tenant.status === 'active' && (
              <DropdownMenuItem 
                onClick={handleSuspend}
                disabled={suspend.isPending}
                className="text-destructive"
              >
                <XCircle className="mr-2 h-4 w-4" />
                Suspender
              </DropdownMenuItem>
            )}
            {tenant.status === 'suspended' && (
              <DropdownMenuItem 
                onClick={handleActivate}
                disabled={activate.isPending}
              >
                <CheckCircle className="mr-2 h-4 w-4 text-green-500" />
                Reactivar
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setEditOpen(true)}>
              <Pencil className="mr-2 h-4 w-4" />
              Editar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  )
}

function CreateTenantDialog() {
  const [open, setOpen] = useState(false)
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    plan: 'basic',
    contactName: '',
    contactEmail: '',
    contactPhone: '',
  })
  
  const createTenant = useCreateTenant()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    createTenant.mutate({
      id: formData.id,
      name: formData.name,
      plan: formData.plan as 'basic' | 'pro',
      contact: formData.contactEmail ? {
        name: formData.contactName,
        email: formData.contactEmail,
        phone: formData.contactPhone || undefined,
      } : undefined,
    }, {
      onSuccess: () => {
        setOpen(false)
        setFormData({
          id: '',
          name: '',
          plan: 'basic',
          contactName: '',
          contactEmail: '',
          contactPhone: '',
        })
      },
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="mr-2 h-4 w-4" />
          Nuevo Tenant
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Crear Tenant</DialogTitle>
            <DialogDescription>
              Registra una nueva organización. El ID debe ser el org_id de Clerk.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="id">Clerk Org ID *</Label>
              <Input
                id="id"
                placeholder="org_2abc123def456"
                value={formData.id}
                onChange={(e) => setFormData({ ...formData, id: e.target.value })}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="name">Nombre *</Label>
              <Input
                id="name"
                placeholder="Estudio Contable SAC"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="plan">Plan</Label>
              <select
                id="plan"
                title="Plan de suscripción"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={formData.plan}
                onChange={(e) => setFormData({ ...formData, plan: e.target.value })}
              >
                <option value="basic">Basic</option>
                <option value="pro">Pro</option>
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="contactName">Contacto - Nombre</Label>
              <Input
                id="contactName"
                placeholder="Juan Pérez"
                value={formData.contactName}
                onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="contactEmail">Contacto - Email</Label>
              <Input
                id="contactEmail"
                type="email"
                placeholder="juan@estudio.pe"
                value={formData.contactEmail}
                onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={createTenant.isPending}>
              {createTenant.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creando...
                </>
              ) : (
                'Crear Tenant'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

interface EditTenantDialogProps {
  tenant: Tenant
  open: boolean
  onOpenChange: (open: boolean) => void
}

function EditTenantDialog({ tenant, open, onOpenChange }: EditTenantDialogProps) {
  const [formData, setFormData] = useState({
    name: tenant.name,
    plan: tenant.plan || 'basic',
    contactName: tenant.contact?.name || '',
    contactEmail: tenant.contact?.email || '',
    contactPhone: tenant.contact?.phone || '',
  })
  
  const updateTenant = useUpdateTenant()

  // Reset form when dialog opens with new tenant data
  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      setFormData({
        name: tenant.name,
        plan: tenant.plan || 'basic',
        contactName: tenant.contact?.name || '',
        contactEmail: tenant.contact?.email || '',
        contactPhone: tenant.contact?.phone || '',
      })
    }
    onOpenChange(newOpen)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    updateTenant.mutate({
      id: tenant.id,
      data: {
        name: formData.name,
        plan: formData.plan as 'basic' | 'pro',
        contact: formData.contactEmail ? {
          name: formData.contactName,
          email: formData.contactEmail,
          phone: formData.contactPhone || undefined,
        } : undefined,
      },
    }, {
      onSuccess: () => {
        onOpenChange(false)
      },
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Editar Tenant</DialogTitle>
            <DialogDescription>
              Modifica los datos de la organización {tenant.name}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-id">ID (no editable)</Label>
              <Input
                id="edit-id"
                value={tenant.id}
                disabled
                className="bg-muted"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-clerk-org">Clerk Org ID</Label>
              <Input
                id="edit-clerk-org"
                value={tenant.clerk_org_id || 'No vinculado'}
                disabled
                className="bg-muted"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-name">Nombre *</Label>
              <Input
                id="edit-name"
                placeholder="Estudio Contable SAC"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-plan">Plan</Label>
              <select
                id="edit-plan"
                title="Plan de suscripción"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={formData.plan}
                onChange={(e) => setFormData({ ...formData, plan: e.target.value as 'basic' | 'pro' | 'enterprise' })}
              >
                <option value="basic">Basic</option>
                <option value="pro">Pro</option>
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-contactName">Contacto - Nombre</Label>
              <Input
                id="edit-contactName"
                placeholder="Juan Pérez"
                value={formData.contactName}
                onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-contactEmail">Contacto - Email</Label>
              <Input
                id="edit-contactEmail"
                type="email"
                placeholder="juan@estudio.pe"
                value={formData.contactEmail}
                onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-contactPhone">Contacto - Teléfono</Label>
              <Input
                id="edit-contactPhone"
                type="tel"
                placeholder="+51 999 999 999"
                value={formData.contactPhone}
                onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={updateTenant.isPending}>
              {updateTenant.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Guardando...
                </>
              ) : (
                'Guardar Cambios'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
