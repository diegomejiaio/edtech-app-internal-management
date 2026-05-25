import type { ProblemDetails } from './types';

const GENERIC_VALIDATION_DETAIL = "See 'errors' for field-level details.";

const FIELD_LABELS: Record<string, string> = {
  amount: 'Monto',
  capacity: 'Capacidad',
  category: 'Categoría',
  concept: 'Concepto',
  course: 'Curso',
  courseDurationHours: 'Duración del curso',
  date: 'Fecha',
  description: 'Descripción',
  docNumber: 'Documento',
  email: 'Correo',
  enrollmentDate: 'Fecha de matrícula',
  enrollmentId: 'Matrícula',
  endTime: 'Hora fin',
  firstName: 'Nombre',
  installmentNumber: 'Cuota',
  lastName: 'Apellido',
  level: 'Nivel',
  month: 'Mes',
  paymentMethod: 'Medio de pago',
  price: 'Precio',
  scheduleId: 'Horario',
  startTime: 'Hora inicio',
  status: 'Estado',
  studentId: 'Alumno',
  teacherId: 'Profesor',
  weekdays: 'Días',
};

/** Typed error thrown when the API returns a non-2xx response. */
export class ApiError extends Error {
  constructor(
    public readonly problem: ProblemDetails,
    public readonly httpStatus: number,
    public readonly url: string,
  ) {
    super(`${problem.status} ${problem.title}: ${problem.detail ?? ''}`);
    this.name = 'ApiError';
  }
}

/** Type-guard: narrows an unknown error to `ApiError`. */
export function isApiError(err: unknown): err is ApiError {
  return err instanceof ApiError;
}

/** 404 Not Found. */
export function isNotFound(err: unknown): boolean {
  return isApiError(err) && err.httpStatus === 404;
}

/** 409 Conflict (duplicate, concurrent edit, dependent records). */
export function isConflict(err: unknown): boolean {
  return isApiError(err) && err.httpStatus === 409;
}

/** 422 Unprocessable Entity (validation). */
export function isValidation(err: unknown): boolean {
  return isApiError(err) && err.httpStatus === 422;
}

/** 401 Unauthorized (missing or invalid token). */
export function isUnauthorized(err: unknown): boolean {
  return isApiError(err) && err.httpStatus === 401;
}

/** 403 Forbidden (valid token but insufficient role). */
export function isForbidden(err: unknown): boolean {
  return isApiError(err) && err.httpStatus === 403;
}

/** Formats API errors for Spanish UI surfaces. */
export function getApiErrorMessage(err: unknown, fallback = 'Error inesperado'): string {
  if (!isApiError(err)) return fallback;

  const validationMessage = formatValidationErrors(err.problem);
  if (validationMessage) return validationMessage;

  return err.problem.detail?.trim() || err.message || fallback;
}

function formatValidationErrors(problem: ProblemDetails): string | undefined {
  const errors = readProblemErrors(problem);
  if (!errors.length) return undefined;

  return errors
    .map(({ field, message }) => `${fieldLabel(field)}: ${translateValidationMessage(field, message)}`)
    .join('\n');
}

function readProblemErrors(problem: ProblemDetails): Array<{ field: string; message: string }> {
  const rawErrors = problem.errors;
  if (!isErrorRecord(rawErrors)) return [];

  return Object.entries(rawErrors).flatMap(([field, messages]) => {
    if (Array.isArray(messages)) {
      return messages.filter(isNonEmptyString).map((message) => ({ field, message }));
    }

    return isNonEmptyString(messages) ? [{ field, message: messages }] : [];
  });
}

function isErrorRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function fieldLabel(field: string): string {
  return FIELD_LABELS[field] ?? field;
}

function translateValidationMessage(field: string, message: string): string {
  const trimmed = message.trim();
  const label = fieldLabel(field);

  if (trimmed === GENERIC_VALIDATION_DETAIL) return 'Revisa este campo.';
  if (/^The .+ field is required\.$/i.test(trimmed) || /^.+ is required\./i.test(trimmed)) return 'es obligatorio.';
  if (/^.+ is required \(format YYYY-MM\)\.$/i.test(trimmed)) return 'es obligatorio (formato YYYY-MM).';
  if (/^Email format is invalid\.$/i.test(trimmed)) return 'tiene formato inválido.';
  if (/^Capacity must be greater than zero\.$/i.test(trimmed)) return 'debe ser mayor que cero.';
  if (/^amount must be greater than zero\.$/i.test(trimmed)) return 'debe ser mayor que cero.';
  if (/^Price cannot be negative\.$/i.test(trimmed)) return 'no puede ser negativo.';
  if (/^installmentNumber must be 1 or greater\.$/i.test(trimmed)) return 'debe ser 1 o mayor.';
  if (/^endTime must be later than startTime\.$/i.test(trimmed)) return 'debe ser posterior a Hora inicio.';

  const oneOfMatch = trimmed.match(/^weekdays must be one of: (.+)\.$/i);
  if (oneOfMatch) return `debe ser uno de: ${oneOfMatch[1]}.`;

  const inactiveMatch = trimmed.match(/^(.+) '(.+)' does not exist or is inactive\.$/i);
  if (inactiveMatch) return `${label} "${inactiveMatch[2]}" no existe o está inactivo.`;

  if (/^Duration metadata is missing for course/i.test(trimmed)) {
    return 'falta configurar la duración para este curso y nivel.';
  }

  return trimmed;
}
