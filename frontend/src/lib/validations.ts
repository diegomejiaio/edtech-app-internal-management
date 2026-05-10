import { z } from "zod";

// Schemas reutilizables
export const rucSchema = z.string().length(11, "RUC debe tener 11 dígitos");

export const emailSchema = z.string().email("Email inválido");

// Ejemplo de schema para formularios
export const empresaSchema = z.object({
  ruc: rucSchema,
  razonSocial: z.string().min(1, "Razón social requerida"),
  direccion: z.string().optional(),
  telefono: z.string().optional(),
  email: emailSchema.optional().or(z.literal("")),
});

export type EmpresaFormData = z.infer<typeof empresaSchema>;
