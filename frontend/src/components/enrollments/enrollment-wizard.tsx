'use client';

/**
 * EnrollmentWizard — 2-step modal mirroring the legacy GAS sidebar flow.
 *
 * Step 1: pick a schedule (filtered by course).
 * Step 2: pick or create a student + optional initial payment.
 *
 * On submit, performs (sequentially, non-atomic):
 *   1. createStudent (only if "new student" mode)
 *   2. createEnrollment
 *   3. createStudentPayment (only if amount > 0)
 *
 * Partial failure: if step 3 fails after enrollment is created, surfaces a
 * warning toast — the enrollment remains. User can retry payment from the
 * student-payments page.
 */

import { useMemo, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import {
  FormSheet,
  FormSheetHeader,
  FormSheetContent,
  FormSheetFooter,
} from '@/components/ui/form-sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { CatalogSelect } from '@/components/pickers';
import { formatTableDate } from '@/lib/dates';
import { useApiClient } from '@/hooks/use-api-client';
import {
  useCatalog,
  useInfiniteSchedules,
  useInfiniteStudents,
  useCreateEnrollment,
  useCreateStudent,
  useCreateStudentPayment,
} from '@/hooks';
import {
  isApiError,
  isConflict,
  DOC_TYPE_LABELS,
  type DocType,
  type Schedule,
  type Student,
} from '@/lib/api';

interface EnrollmentWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after a successful enrollment (and optional payment). */
  onSuccess?: () => void;
}

type StudentMode = 'search' | 'selected' | 'new';

const DOC_TYPES: DocType[] = ['dni', 'ce', 'passport'];

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatScheduleLabel(s: Schedule): string {
  return `${s.course} — ${s.weekdays} ${s.startTime}-${s.endTime} (inicio ${formatTableDate(s.startDate)})`;
}

export function EnrollmentWizard({ open, onOpenChange, onSuccess }: EnrollmentWizardProps) {
  const client = useApiClient();

  // ── Step 1 state ────────────────────────────────────────────────────────
  const [step, setStep] = useState<1 | 2>(1);
  const [courseFilter, setCourseFilter] = useState<string>('all');
  const [scheduleId, setScheduleId] = useState<string>('');

  const { data: schedulesData, isLoading: schedulesLoading } = useInfiniteSchedules(client, {
    status: 'active',
    course: courseFilter === 'all' ? undefined : courseFilter,
    limit: 100,
  });
  const schedules = useMemo<Schedule[]>(
    () => schedulesData?.pages.flatMap((p) => p.items) ?? [],
    [schedulesData],
  );
  const selectedSchedule = schedules.find((s) => s.id === scheduleId);

  // ── Step 2 state ────────────────────────────────────────────────────────
  const [mode, setMode] = useState<StudentMode>('search');
  const [search, setSearch] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  // New-student form
  const [newDocType, setNewDocType] = useState<DocType>('dni');
  const [newDocNumber, setNewDocNumber] = useState('');
  const [newFirstName, setNewFirstName] = useState('');
  const [newLastName, setNewLastName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newSource, setNewSource] = useState<string | undefined>();
  const [newStudentNotes, setNewStudentNotes] = useState('');

  // Payment form (optional)
  const [amount, setAmount] = useState('');
  const [installmentNumber, setInstallmentNumber] = useState('1');
  const [paymentMethod, setPaymentMethod] = useState<string | undefined>();
  const [hasReceipt, setHasReceipt] = useState(false);
  const [receiptNumber, setReceiptNumber] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');

  // Student typeahead — only triggers when search is meaningful.
  const enabledSearch = search.trim().length >= 2;
  const { data: searchData, isFetching: searchLoading } = useInfiniteStudents(client, {
    search: enabledSearch ? search.trim() : undefined,
    limit: 7,
  });
  const searchResults = useMemo<Student[]>(
    () => (enabledSearch ? (searchData?.pages.flatMap((p) => p.items) ?? []) : []),
    [searchData, enabledSearch],
  );

  // Active courses for the filter dropdown (from loaded schedules + catalog).
  const { data: coursesCatalog } = useCatalog(client, 'courses');
  const courseOptions = useMemo(() => {
    const fromCatalog = coursesCatalog?.items.filter((i) => i.active).map((i) => i.value) ?? [];
    return Array.from(new Set(fromCatalog)).sort();
  }, [coursesCatalog]);

  const createStudentMutation = useCreateStudent(client);
  const createEnrollmentMutation = useCreateEnrollment(client);
  const createPaymentMutation = useCreateStudentPayment(client);
  const isSubmitting =
    createStudentMutation.isPending ||
    createEnrollmentMutation.isPending ||
    createPaymentMutation.isPending;

  function resetAll() {
    setStep(1);
    setCourseFilter('all');
    setScheduleId('');
    setMode('search');
    setSearch('');
    setSelectedStudent(null);
    setNewDocType('dni');
    setNewDocNumber('');
    setNewFirstName('');
    setNewLastName('');
    setNewPhone('');
    setNewEmail('');
    setNewSource(undefined);
    setNewStudentNotes('');
    setAmount('');
    setInstallmentNumber('1');
    setPaymentMethod(undefined);
    setHasReceipt(false);
    setReceiptNumber('');
    setPaymentNotes('');
  }

  function handleOpenChange(next: boolean) {
    if (!next) resetAll();
    onOpenChange(next);
  }

  function handleSelectExisting(s: Student) {
    setSelectedStudent(s);
    setMode('selected');
    setSearch('');
  }

  function handleChangeStudent() {
    setSelectedStudent(null);
    setMode('search');
  }

  function handleShowNew() {
    setSelectedStudent(null);
    setMode('new');
  }

  function continueToStep2() {
    if (!scheduleId) {
      toast.error('Selecciona un horario primero');
      return;
    }
    setStep(2);
  }

  async function handleSubmit(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    if (!scheduleId) {
      toast.error('Selecciona un horario');
      return;
    }

    // Resolve studentId based on mode.
    let studentId: string | undefined;
    if (mode === 'selected' && selectedStudent) {
      studentId = selectedStudent.id;
    } else if (mode === 'new') {
      if (!newDocNumber.trim() || !newFirstName.trim() || !newLastName.trim()) {
        toast.error('Documento, nombre y apellido son obligatorios');
        return;
      }
      try {
        const created = await createStudentMutation.mutateAsync({
          firstName: newFirstName.trim(),
          lastName: newLastName.trim(),
          docType: newDocType,
          docNumber: newDocNumber.trim(),
          phone: newPhone.trim() || null,
          email: newEmail.trim() || null,
          source: newSource ?? null,
          notes: newStudentNotes.trim() || null,
        });
        studentId = created.id;
      } catch (err) {
        if (isConflict(err)) toast.error('Ya existe un alumno con ese documento');
        else if (isApiError(err)) toast.error(err.problem.detail ?? err.message);
        else toast.error('Error al crear alumno');
        return;
      }
    } else {
      toast.error('Selecciona o registra un alumno');
      return;
    }

    // Create the enrollment.
    let enrollmentId: string;
    try {
      const enrollment = await createEnrollmentMutation.mutateAsync({
        studentId: studentId!,
        scheduleId,
        enrollmentDate: todayIso(),
        status: 'active',
      });
      enrollmentId = enrollment.id;
    } catch (err) {
      if (isConflict(err)) toast.error('Ya existe una inscripción activa para este alumno en este horario');
      else if (isApiError(err)) toast.error(err.problem.detail ?? err.message);
      else toast.error('Error al crear inscripción');
      return;
    }

    // Optional initial payment.
    const amountNum = Number.parseFloat(amount);
    if (amount.trim() && amountNum > 0) {
      if (!paymentMethod) {
        toast.warning('Inscripción creada. Falta medio de pago: el pago inicial no se registró.');
        onSuccess?.();
        handleOpenChange(false);
        return;
      }
      try {
        await createPaymentMutation.mutateAsync({
          enrollmentId,
          date: todayIso(),
          amount: amountNum,
          installmentNumber: Number.parseInt(installmentNumber, 10) || 1,
          paymentMethod,
          hasReceipt,
          receiptNumber: hasReceipt ? receiptNumber.trim() || null : null,
          notes: paymentNotes.trim() || null,
        });
        toast.success('Inscripción y pago inicial registrados');
      } catch (err) {
        const detail = isApiError(err) ? err.problem.detail ?? err.message : 'error desconocido';
        toast.warning(`Inscripción creada, pero falló el pago inicial: ${detail}`);
      }
    } else {
      toast.success('Inscripción creada');
    }

    onSuccess?.();
    handleOpenChange(false);
  }

  return (
    <FormSheet open={open} onOpenChange={handleOpenChange}>
      <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
        <FormSheetHeader
          title="Nueva inscripción"
          description={step === 1 ? 'Paso 1 — Elegir horario' : 'Paso 2 — Alumno y pago inicial'}
        />

        <FormSheetContent className="space-y-4">
          {step === 1 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Filtrar por curso</Label>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setCourseFilter('all')}
                    className={`px-3 py-1.5 rounded-md text-sm border transition-colors ${
                      courseFilter === 'all'
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-background hover:bg-muted border-input'
                    }`}
                  >
                    Todos
                  </button>
                  {courseOptions.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCourseFilter(c)}
                      className={`px-3 py-1.5 rounded-md text-sm border transition-colors ${
                        courseFilter === c
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-background hover:bg-muted border-input'
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>
                  Horario <span className="text-destructive">*</span>
                </Label>
                <Select value={scheduleId} onValueChange={setScheduleId} disabled={schedulesLoading}>
                  <SelectTrigger>
                    <SelectValue placeholder={schedulesLoading ? 'Cargando...' : '— Seleccionar —'} />
                  </SelectTrigger>
                  <SelectContent>
                    {schedules.length === 0 && !schedulesLoading && (
                      <SelectItem value="_empty" disabled>
                        Sin horarios activos
                      </SelectItem>
                    )}
                    {schedules.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {formatScheduleLabel(s)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedSchedule && (
                <div className="rounded-md border bg-muted/50 p-4 space-y-1 text-sm">
                  <InfoRow label="Curso" value={selectedSchedule.course} />
                  <InfoRow label="Profesor" value={selectedSchedule.teacherName} />
                  <InfoRow label="Días" value={selectedSchedule.weekdays} />
                  <InfoRow
                    label="Horario"
                    value={`${selectedSchedule.startTime} – ${selectedSchedule.endTime}`}
                  />
                  <InfoRow label="Fecha inicio" value={formatTableDate(selectedSchedule.startDate)} />
                  <InfoRow label="Precio" value={`S/ ${selectedSchedule.price.toFixed(2)}`} />
                  <InfoRow label="Capacidad" value={String(selectedSchedule.capacity)} />
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              {/* Student selector */}
              {mode === 'search' && (
                <div className="space-y-2">
                  <Label>Buscar por nombre o documento</Label>
                  <Input
                    placeholder="Escribe al menos 2 caracteres..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    autoFocus
                  />
                  {enabledSearch && (
                    <div className="rounded-md border max-h-56 overflow-y-auto">
                      {searchLoading && (
                        <div className="p-3 text-sm text-muted-foreground">Buscando…</div>
                      )}
                      {!searchLoading && searchResults.length === 0 && (
                        <div className="p-3 text-sm text-muted-foreground">Sin resultados</div>
                      )}
                      {searchResults.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => handleSelectExisting(s)}
                          className="w-full text-left p-3 hover:bg-muted border-b last:border-b-0 text-sm"
                        >
                          <div className="font-medium">
                            {s.firstName} {s.lastName}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {DOC_TYPE_LABELS[s.docType]}: {s.docNumber}
                            {s.phone ? ` · ${s.phone}` : ''}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                  <Button type="button" variant="outline" onClick={handleShowNew} className="w-full">
                    + Crear nuevo alumno
                  </Button>
                </div>
              )}

              {mode === 'selected' && selectedStudent && (
                <div className="rounded-md border bg-muted/50 p-3 flex items-center justify-between text-sm">
                  <div>
                    <div className="font-medium">
                      ✅ {selectedStudent.firstName} {selectedStudent.lastName}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {DOC_TYPE_LABELS[selectedStudent.docType]}: {selectedStudent.docNumber}
                    </div>
                  </div>
                  <Button type="button" variant="ghost" size="sm" onClick={handleChangeStudent}>
                    Cambiar ✕
                  </Button>
                </div>
              )}

              {mode === 'new' && (
                <div className="space-y-3 rounded-md border p-3 bg-muted/30">
                  <div className="text-xs text-muted-foreground">
                    Alumno no encontrado — completa los datos para registrarlo
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>
                        Tipo doc. <span className="text-destructive">*</span>
                      </Label>
                      <Select value={newDocType} onValueChange={(v) => setNewDocType(v as DocType)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {DOC_TYPES.map((dt) => (
                            <SelectItem key={dt} value={dt}>
                              {DOC_TYPE_LABELS[dt]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>
                        N° Documento <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        value={newDocNumber}
                        onChange={(e) => setNewDocNumber(e.target.value)}
                        placeholder="12345678"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>
                        Nombre <span className="text-destructive">*</span>
                      </Label>
                      <Input value={newFirstName} onChange={(e) => setNewFirstName(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>
                        Apellido <span className="text-destructive">*</span>
                      </Label>
                      <Input value={newLastName} onChange={(e) => setNewLastName(e.target.value)} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Teléfono</Label>
                      <Input value={newPhone} onChange={(e) => setNewPhone(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Email</Label>
                      <Input
                        type="email"
                        value={newEmail}
                        onChange={(e) => setNewEmail(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Fuente</Label>
                    <CatalogSelect
                      client={client}
                      catalogCode="studentSources"
                      value={newSource}
                      onChange={setNewSource}
                      placeholder="¿Cómo nos encontró?"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Notas alumno</Label>
                    <Textarea
                      value={newStudentNotes}
                      onChange={(e) => setNewStudentNotes(e.target.value)}
                      rows={2}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setMode('search')}
                    className="w-full"
                  >
                    ← Volver a búsqueda
                  </Button>
                </div>
              )}

              {/* Initial payment (optional) */}
              <div className="border-t pt-4 space-y-3">
                <div className="text-sm font-medium">Pago inicial (opcional)</div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Monto (S/)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Cuota N°</Label>
                    <Input
                      type="number"
                      min="1"
                      value={installmentNumber}
                      onChange={(e) => setInstallmentNumber(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Medio de pago</Label>
                  <CatalogSelect
                    client={client}
                    catalogCode="paymentMethods"
                    value={paymentMethod}
                    onChange={setPaymentMethod}
                    placeholder="Seleccionar medio..."
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="hasReceipt">Boleta</Label>
                  <Switch id="hasReceipt" checked={hasReceipt} onCheckedChange={setHasReceipt} />
                </div>
                {hasReceipt && (
                  <div className="space-y-1.5">
                    <Label>N° Boleta</Label>
                    <Input
                      value={receiptNumber}
                      onChange={(e) => setReceiptNumber(e.target.value)}
                      placeholder="B001-00123"
                    />
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label>Notas</Label>
                  <Textarea
                    value={paymentNotes}
                    onChange={(e) => setPaymentNotes(e.target.value)}
                    rows={2}
                  />
                </div>
              </div>
            </div>
          )}
        </FormSheetContent>

        <FormSheetFooter>
          {step === 1 ? (
            <>
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="button" onClick={continueToStep2} disabled={!scheduleId}>
                Continuar →
              </Button>
            </>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep(1)}
                disabled={isSubmitting}
              >
                ← Atrás
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Guardar
              </Button>
            </>
          )}
        </FormSheetFooter>
      </form>
    </FormSheet>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  );
}
