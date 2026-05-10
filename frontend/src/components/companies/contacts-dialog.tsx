'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Mail,
  Plus,
  Trash2,
  User,
  Star,
  Loader2,
  UserPlus,
  Pencil,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Skeleton } from '@/components/ui/skeleton'
import {
  useCompanyContacts,
  useCreateContact,
  useUpdateContact,
  useDeleteContact,
  useToggleContactNotifications,
} from '@/hooks/use-contacts'
import type { Company, CompanyContact } from '@/types'

// ─────────────────────────────────────────────────────────────────────────────
// Schema
// ─────────────────────────────────────────────────────────────────────────────

const contactSchema = z.object({
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  email: z.string().email('Ingresa un email válido'),
  role: z.string().optional(),
  is_primary: z.boolean(),
  receives_notifications: z.boolean(),
})

type ContactFormData = z.infer<typeof contactSchema>

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

interface ContactsDialogProps {
  company: Company | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function ContactsDialog({ company, open, onOpenChange }: ContactsDialogProps) {
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingContact, setEditingContact] = useState<CompanyContact | null>(null)
  const [contactToDelete, setContactToDelete] = useState<CompanyContact | null>(null)

  const { data, isLoading } = useCompanyContacts(company?.id)
  const createMutation = useCreateContact()
  const updateMutation = useUpdateContact()
  const deleteMutation = useDeleteContact()
  const toggleNotificationsMutation = useToggleContactNotifications()

  const contacts = data?.items ?? []

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ContactFormData>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      name: '',
      email: '',
      role: '',
      is_primary: false,
      receives_notifications: true,
    },
  })

  const receivesNotifications = watch('receives_notifications')
  const isPrimary = watch('is_primary')

  // Reset form when editing contact changes
  useEffect(() => {
    if (editingContact) {
      reset({
        name: editingContact.name,
        email: editingContact.email,
        role: editingContact.role || '',
        is_primary: editingContact.is_primary,
        receives_notifications: editingContact.receives_notifications,
      })
    }
  }, [editingContact, reset])

  const handleAddContact = async (data: ContactFormData) => {
    if (!company) return

    await createMutation.mutateAsync({
      companyId: company.id,
      data: {
        name: data.name,
        email: data.email,
        role: data.role || undefined,
        is_primary: data.is_primary,
        receives_notifications: data.receives_notifications,
      },
    })

    reset()
    setShowAddForm(false)
  }

  const handleEditContact = async (data: ContactFormData) => {
    if (!company || !editingContact) return

    await updateMutation.mutateAsync({
      companyId: company.id,
      contactId: editingContact.id,
      data: {
        name: data.name,
        email: data.email,
        role: data.role || undefined,
        is_primary: data.is_primary,
        receives_notifications: data.receives_notifications,
      },
    })

    reset()
    setEditingContact(null)
  }

  const handleToggleNotifications = async (contact: CompanyContact) => {
    if (!company) return

    await toggleNotificationsMutation.mutateAsync({
      companyId: company.id,
      contactId: contact.id,
      receives: !contact.receives_notifications,
    })
  }

  const handleSetPrimary = async (contact: CompanyContact) => {
    if (!company || contact.is_primary) return

    await updateMutation.mutateAsync({
      companyId: company.id,
      contactId: contact.id,
      data: { is_primary: true },
    })
  }

  const handleDeleteContact = async () => {
    if (!company || !contactToDelete) return

    await deleteMutation.mutateAsync({
      companyId: company.id,
      contactId: contactToDelete.id,
    })

    setContactToDelete(null)
  }

  const handleStartEdit = (contact: CompanyContact) => {
    setShowAddForm(false)
    setEditingContact(contact)
  }

  const handleCancelEdit = () => {
    setEditingContact(null)
    reset({
      name: '',
      email: '',
      role: '',
      is_primary: false,
      receives_notifications: true,
    })
  }

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setShowAddForm(false)
      setEditingContact(null)
      reset()
    }
    onOpenChange(isOpen)
  }

  const isEditing = editingContact !== null

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Contactos de {company?.business_name}
            </DialogTitle>
            <DialogDescription>
              Gestiona los contactos que recibirán notificaciones por email para esta empresa.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-4 overflow-y-auto flex-1 pb-2">
            {/* Lista de contactos */}
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 2 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 border rounded-lg">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-48" />
                    </div>
                    <Skeleton className="h-8 w-20" />
                  </div>
                ))}
              </div>
            ) : contacts.length === 0 && !showAddForm ? (
              <div className="flex flex-col items-center justify-center py-8 text-center border rounded-lg border-dashed">
                <UserPlus className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-medium">Sin contactos</h3>
                <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                  Agrega contactos para que reciban notificaciones de SUNAT por email.
                </p>
                <Button
                  className="mt-4"
                  onClick={() => setShowAddForm(true)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Agregar contacto
                </Button>
              </div>
            ) : (
              <TooltipProvider>
                <div className="space-y-2">
                  {contacts.map((contact) => (
                    <div
                      key={`${contact.id}-${contact.receives_notifications}`}
                      className="p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      {/* Row 1: Avatar, Name, Badge, Actions */}
                      <div className="flex items-center gap-3">
                        {/* Avatar */}
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <User className="h-5 w-5 text-primary" />
                        </div>

                        {/* Name and Badge */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium">{contact.name}</span>
                            {contact.is_primary && (
                              <Badge variant="secondary" className="text-xs">
                                <Star className="h-3 w-3 mr-1" />
                                Principal
                              </Badge>
                            )}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1 shrink-0">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => handleStartEdit(contact)}
                                disabled={isEditing}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Editar contacto</TooltipContent>
                          </Tooltip>

                          {!contact.is_primary && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => handleSetPrimary(contact)}
                                  disabled={updateMutation.isPending}
                                >
                                  <Star className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Marcar como principal</TooltipContent>
                            </Tooltip>
                          )}

                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => setContactToDelete(contact)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Eliminar contacto</TooltipContent>
                          </Tooltip>
                        </div>
                      </div>

                      {/* Row 2: Email, Role, Switch */}
                      <div className="flex items-center justify-between mt-2 ml-13 pl-0.5">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground min-w-0">
                          <Mail className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{contact.email}</span>
                          {contact.role && (
                            <>
                              <span className="shrink-0">·</span>
                              <span className="truncate">{contact.role}</span>
                            </>
                          )}
                        </div>

                        {/* Toggle notificaciones */}
                        <div className="flex items-center gap-2 shrink-0 ml-4">
                          <Switch
                            id={`notifications-${contact.id}`}
                            checked={contact.receives_notifications}
                            onCheckedChange={() => handleToggleNotifications(contact)}
                            disabled={toggleNotificationsMutation.isPending}
                          />
                          <Label 
                            htmlFor={`notifications-${contact.id}`}
                            className="text-xs text-muted-foreground cursor-pointer whitespace-nowrap"
                          >
                            {contact.receives_notifications ? 'Notifica' : 'No notifica'}
                          </Label>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </TooltipProvider>
            )}

            {/* Formulario para editar */}
            {isEditing && (
              <div className="border rounded-lg p-4 bg-muted/30">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-medium">Editar contacto</h4>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={handleCancelEdit}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <form onSubmit={handleSubmit(handleEditContact)} className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="edit-name">Nombre</Label>
                      <Input
                        id="edit-name"
                        placeholder="Juan Pérez"
                        {...register('name')}
                      />
                      {errors.name && (
                        <p className="text-sm text-destructive">{errors.name.message}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-email">Email</Label>
                      <Input
                        id="edit-email"
                        type="email"
                        placeholder="juan@empresa.com"
                        {...register('email')}
                      />
                      {errors.email && (
                        <p className="text-sm text-destructive">{errors.email.message}</p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="edit-role">Cargo (opcional)</Label>
                    <Input
                      id="edit-role"
                      placeholder="Contador, Gerente, etc."
                      {...register('role')}
                    />
                  </div>

                  <div className="flex flex-col gap-4 sm:flex-row sm:gap-6">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="edit-receives_notifications"
                        checked={receivesNotifications}
                        onCheckedChange={(checked) =>
                          setValue('receives_notifications', checked === true)
                        }
                      />
                      <div className="grid gap-0.5 leading-none">
                        <Label
                          htmlFor="edit-receives_notifications"
                          className="text-sm font-medium cursor-pointer"
                        >
                          Recibe notificaciones
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Recibirá emails de SUNAT
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="edit-is_primary"
                        checked={isPrimary}
                        onCheckedChange={(checked) =>
                          setValue('is_primary', checked === true)
                        }
                      />
                      <div className="grid gap-0.5 leading-none">
                        <Label
                          htmlFor="edit-is_primary"
                          className="text-sm font-medium cursor-pointer"
                        >
                          Contacto principal
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Contacto por defecto
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleCancelEdit}
                    >
                      Cancelar
                    </Button>
                    <Button type="submit" disabled={updateMutation.isPending}>
                      {updateMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Guardando...
                        </>
                      ) : (
                        'Guardar cambios'
                      )}
                    </Button>
                  </div>
                </form>
              </div>
            )}

            {/* Formulario para agregar */}
            {showAddForm && !isEditing ? (
              <div className="border rounded-lg p-4 bg-muted/30">
                <h4 className="font-medium mb-4">Nuevo contacto</h4>
                <form onSubmit={handleSubmit(handleAddContact)} className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="name">Nombre</Label>
                      <Input
                        id="name"
                        placeholder="Juan Pérez"
                        {...register('name')}
                      />
                      {errors.name && (
                        <p className="text-sm text-destructive">{errors.name.message}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="juan@empresa.com"
                        {...register('email')}
                      />
                      {errors.email && (
                        <p className="text-sm text-destructive">{errors.email.message}</p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="role">Cargo (opcional)</Label>
                    <Input
                      id="role"
                      placeholder="Contador, Gerente, etc."
                      {...register('role')}
                    />
                  </div>

                  <div className="flex flex-col gap-4 sm:flex-row sm:gap-6">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="receives_notifications"
                        checked={receivesNotifications}
                        onCheckedChange={(checked) =>
                          setValue('receives_notifications', checked === true)
                        }
                      />
                      <div className="grid gap-0.5 leading-none">
                        <Label
                          htmlFor="receives_notifications"
                          className="text-sm font-medium cursor-pointer"
                        >
                          Recibe notificaciones
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Recibirá emails de SUNAT
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="is_primary"
                        checked={isPrimary}
                        onCheckedChange={(checked) =>
                          setValue('is_primary', checked === true)
                        }
                      />
                      <div className="grid gap-0.5 leading-none">
                        <Label
                          htmlFor="is_primary"
                          className="text-sm font-medium cursor-pointer"
                        >
                          Contacto principal
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Contacto por defecto
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setShowAddForm(false)
                        reset()
                      }}
                    >
                      Cancelar
                    </Button>
                    <Button type="submit" disabled={createMutation.isPending}>
                      {createMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Guardando...
                        </>
                      ) : (
                        <>
                          <Plus className="h-4 w-4 mr-2" />
                          Agregar
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              </div>
            ) : contacts.length > 0 && !isEditing ? (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setShowAddForm(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Agregar contacto
              </Button>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmación de eliminación */}
      <AlertDialog
        open={!!contactToDelete}
        onOpenChange={(open) => !open && setContactToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar contacto</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de eliminar a <strong>{contactToDelete?.name}</strong>?
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteContact}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Eliminando...
                </>
              ) : (
                'Eliminar'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
