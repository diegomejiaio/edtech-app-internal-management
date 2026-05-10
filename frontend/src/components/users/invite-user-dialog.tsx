"use client";

import { useState } from "react";
import { Mail, Loader2, UserPlus, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useInviteUser } from "@/hooks/use-users";

interface InviteUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InviteUserDialog({
  open,
  onOpenChange,
}: InviteUserDialogProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "member">("member");
  const [emailError, setEmailError] = useState("");

  const inviteUser = useInviteUser();

  const validateEmail = (value: string): boolean => {
    if (!value) {
      setEmailError("El email es requerido");
      return false;
    }
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) {
      setEmailError("Ingresa un email válido");
      return false;
    }
    setEmailError("");
    return true;
  };

  const handleEmailChange = (value: string) => {
    setEmail(value);
    if (emailError) {
      validateEmail(value);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateEmail(email)) return;

    inviteUser.mutate(
      { email, role, name: name.trim() || undefined },
      {
        onSuccess: () => {
          onOpenChange(false);
          resetForm();
        },
      },
    );
  };

  const resetForm = () => {
    setName("");
    setEmail("");
    setRole("member");
    setEmailError("");
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      resetForm();
      inviteUser.reset();
    }
    onOpenChange(newOpen);
  };

  // Parse error message for duplicate email (409 conflict)
  const getErrorMessage = (): string => {
    if (!inviteUser.error) return "";
    const message =
      inviteUser.error instanceof Error
        ? inviteUser.error.message
        : "Error al invitar al usuario";

    // Handle specific error cases
    if (
      message.includes("409") ||
      message.toLowerCase().includes("already") ||
      message.toLowerCase().includes("existe")
    ) {
      return "Ya existe un usuario con este email en el estudio";
    }
    return message;
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Invitar Usuario
          </DialogTitle>
          <DialogDescription>
            Envía una invitación por email para que un nuevo miembro se una a tu
            estudio.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nombre</Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="name"
                type="text"
                placeholder="Juan Pérez García"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="off"
                className="pl-9"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Opcional. Se puede actualizar cuando el usuario acepte la
              invitación.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email *</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                placeholder="usuario@ejemplo.com"
                value={email}
                onChange={(e) => handleEmailChange(e.target.value)}
                onBlur={() => email && validateEmail(email)}
                required
                autoComplete="off"
                className={`pl-9 ${emailError ? "border-destructive" : ""}`}
              />
            </div>
            {emailError && (
              <p className="text-xs text-destructive">{emailError}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">Rol *</Label>
            <Select
              value={role}
              onValueChange={(value) => setRole(value as "admin" | "member")}
            >
              <SelectTrigger id="role">
                <SelectValue placeholder="Selecciona un rol" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">
                  <div className="flex flex-col items-start">
                    <span className="font-medium">Administrador</span>
                    <span className="text-xs text-muted-foreground">
                      Acceso total, puede gestionar usuarios y empresas
                    </span>
                  </div>
                </SelectItem>
                <SelectItem value="member">
                  <div className="flex flex-col items-start">
                    <span className="font-medium">Miembro</span>
                    <span className="text-xs text-muted-foreground">
                      Acceso limitado a empresas asignadas
                    </span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {role === "admin"
                ? "Los administradores tienen acceso a todas las empresas y configuraciones."
                : "Los miembros solo pueden ver las empresas que se les asignen."}
            </p>
          </div>

          {inviteUser.isError && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3">
              <p className="text-sm text-destructive">{getErrorMessage()}</p>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={inviteUser.isPending}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={inviteUser.isPending || !email || !!emailError}
            >
              {inviteUser.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enviando...
                </>
              ) : (
                "Enviar Invitación"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
