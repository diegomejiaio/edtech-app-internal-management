"use client";

import { useState, useEffect } from "react";
import {
  Building2,
  Mail,
  Phone,
  User,
  Loader2,
  Save,
  AlertCircle,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FadeIn } from "@/components/motion";
import { useCurrentTenant, useUpdateCurrentTenant } from "@/hooks/use-tenants";
import { useUserRole } from "@/hooks/use-auth";
import { formatLocalDateLong, formatLocalDateTimeLong } from "@/lib/dates";

const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "dev";

const statusConfig = {
  pending: { label: "Pendiente", variant: "secondary" as const },
  active: { label: "Activo", variant: "default" as const },
  suspended: { label: "Suspendido", variant: "destructive" as const },
};

const planConfig = {
  basic: {
    label: "Basic",
    description: "Plan básico con funcionalidades esenciales",
  },
  pro: {
    label: "Pro",
    description: "Plan profesional con todas las funcionalidades",
  },
};

export default function SettingsPage() {
  const { data: tenant, isLoading, error } = useCurrentTenant();
  const updateTenant = useUpdateCurrentTenant();
  const { canManageTenant } = useUserRole();
  const canEdit = canManageTenant;

  const [formData, setFormData] = useState({
    name: "",
    contactName: "",
    contactEmail: "",
    contactPhone: "",
  });
  const [hasChanges, setHasChanges] = useState(false);

  // Initialize form when tenant loads
  useEffect(() => {
    if (tenant) {
      setFormData({
        name: tenant.name || "",
        contactName: tenant.contact?.name || "",
        contactEmail: tenant.contact?.email || "",
        contactPhone: tenant.contact?.phone || "",
      });
      setHasChanges(false);
    }
  }, [tenant]);

  // Track changes
  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleSave = () => {
    updateTenant.mutate(
      {
        name: formData.name,
        contact: formData.contactEmail
          ? {
              name: formData.contactName,
              email: formData.contactEmail,
              phone: formData.contactPhone || undefined,
            }
          : undefined,
      },
      {
        onSuccess: () => {
          setHasChanges(false);
        },
      },
    );
  };

  const handleReset = () => {
    if (tenant) {
      setFormData({
        name: tenant.name || "",
        contactName: tenant.contact?.name || "",
        contactEmail: tenant.contact?.email || "",
        contactPhone: tenant.contact?.phone || "",
      });
      setHasChanges(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !tenant) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          {error?.message || "No se pudo cargar la información del estudio"}
        </AlertDescription>
      </Alert>
    );
  }

  const status = statusConfig[tenant.status] || statusConfig.pending;
  const plan =
    planConfig[tenant.plan as keyof typeof planConfig] || planConfig.basic;

  return (
    <div className="space-y-6">
      {/* Action buttons when there are changes */}
      {canEdit && hasChanges && (
        <FadeIn>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={handleReset}>
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={updateTenant.isPending}
            >
              {updateTenant.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Guardar Cambios
                </>
              )}
            </Button>
          </div>
        </FadeIn>
      )}

      {/* Organization Info */}
      <FadeIn delay={0.1}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Información del Estudio
            </CardTitle>
            <CardDescription>
              Datos generales de la organización
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Status and Plan badges */}
            <div className="flex flex-wrap gap-4">
              <div>
                <Label className="text-xs text-muted-foreground">Estado</Label>
                <div className="mt-1">
                  <Badge variant={status.variant}>{status.label}</Badge>
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Plan</Label>
                <div className="mt-1">
                  <Badge variant="outline">{plan.label}</Badge>
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">ID</Label>
                <div className="mt-1">
                  <code className="text-xs bg-muted px-2 py-1 rounded">
                    {tenant.id}
                  </code>
                </div>
              </div>
            </div>

            <Separator />

            {/* Editable fields */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label htmlFor="name">Nombre del Estudio</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => handleChange("name", e.target.value)}
                  disabled={!canEdit}
                  className="mt-1.5"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </FadeIn>

      {/* Contact Info */}
      <FadeIn delay={0.2}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Información de Contacto
            </CardTitle>
            <CardDescription>
              Persona de contacto principal del estudio
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label
                  htmlFor="contactName"
                  className="flex items-center gap-2"
                >
                  <User className="h-4 w-4 text-muted-foreground" />
                  Nombre
                </Label>
                <Input
                  id="contactName"
                  value={formData.contactName}
                  onChange={(e) => handleChange("contactName", e.target.value)}
                  placeholder="Juan Pérez"
                  disabled={!canEdit}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label
                  htmlFor="contactEmail"
                  className="flex items-center gap-2"
                >
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  Email
                </Label>
                <Input
                  id="contactEmail"
                  type="email"
                  value={formData.contactEmail}
                  onChange={(e) => handleChange("contactEmail", e.target.value)}
                  placeholder="contacto@estudio.pe"
                  disabled={!canEdit}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label
                  htmlFor="contactPhone"
                  className="flex items-center gap-2"
                >
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  Teléfono
                </Label>
                <Input
                  id="contactPhone"
                  type="tel"
                  value={formData.contactPhone}
                  onChange={(e) => handleChange("contactPhone", e.target.value)}
                  placeholder="+51 999 999 999"
                  disabled={!canEdit}
                  className="mt-1.5"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </FadeIn>

      {/* Metadata (read-only) */}
      <FadeIn delay={0.3}>
        <Card>
          <CardHeader>
            <CardTitle>Información Adicional</CardTitle>
            <CardDescription>Datos del sistema (solo lectura)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <Label className="text-xs text-muted-foreground">
                  Clerk Org ID
                </Label>
                <p className="text-sm font-mono mt-1">
                  {tenant.clerk_org_id || (
                    <span className="text-muted-foreground">No vinculado</span>
                  )}
                </p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">
                  Fecha de Creación
                </Label>
                <p className="text-sm mt-1">
                  {formatLocalDateLong(tenant.created_at)}
                </p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">
                  Fecha de Activación
                </Label>
                <p className="text-sm mt-1">
                  {formatLocalDateLong(tenant.activated_at)}
                </p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">
                  Última Actualización
                </Label>
                <p className="text-sm mt-1">
                  {formatLocalDateTimeLong(tenant.updated_at)}
                </p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">
                  Versión Frontend
                </Label>
                <p className="text-sm font-mono mt-1">{APP_VERSION}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </FadeIn>

      {/* Help text for non-admin users */}
      {!canEdit && (
        <FadeIn delay={0.4}>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Solo los administradores pueden modificar la configuración del
              estudio. Contacta a tu administrador si necesitas realizar
              cambios.
            </AlertDescription>
          </Alert>
        </FadeIn>
      )}
    </div>
  );
}
