'use client';

/**
 * EnrollmentWizard — single-form enrollment creation.
 *
 * Mirrors the dashboard QuickEnrollmentSheet UX (Alumno · Horario · Fecha) and
 * adds two affordances on the same sheet:
 *   1. "+ Crear alumno" — inline-expandable form to register a new student
 *      without leaving the flow.
 *   2. "Pago inicial (opcional)" — collapsible block to register the first
 *      installment in the same transaction.
 *
 * Submit order (sequential, non-atomic):
 *   1. createStudent (only when the new-student form is active)
 *   2. createEnrollment
 *   3. createStudentPayment (only when amount > 0)
 *
 * Partial failure: if step 3 fails after the enrollment is persisted, a
 * warning toast is surfaced; the enrollment stays. The operator can register
 * the payment later from the student-payments page.
 */

import { useEffect, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { FormSheetDialog } from '@/components/data';
import { StudentPicker, SchedulePicker, CatalogSelect } from '@/components/pickers';
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
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useApiClient } from '@/hooks/use-api-client';
import {
  useCreateEnrollment,
  useCreateStudent,
  useCreateStudentPayment,
} from '@/hooks';
import {
  isApiError,
  isConflict,
  getApiErrorMessage,
  DOC_TYPE_LABELS,
  type DocType,
} from '@/lib/api';
import { cn } from '@/lib/utils';
import { toIsoDate } from '@/lib/dashboard-period';

interface EnrollmentWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after a successful enrollment (and optional payment). */
  onSuccess?: () => void;
}

const DOC_TYPES: DocType[] = ['dni', 'ce', 'passport'];

/** Default traceability note stamped on each payment of a pack enrollment. */
const PACK_NOTE = 'Pack';

export function EnrollmentWizard({ open, onOpenChange, onSuccess }: EnrollmentWizardProps) {
  const client = useApiClient();

  // Core selection
  const [studentId, setStudentId] = useState<string | undefined>();
  const [scheduleId, setScheduleId] = useState<string | undefined>();
  const [enrollmentDate, setEnrollmentDate] = useState<string>(toIsoDate(new Date()));
  // Negotiated price: defaults to the picked schedule's list price, editable for discounts/packs.
  const [price, setPrice] = useState<string>('');

  // Pack mode: enroll in a second schedule (Básico + Avanzado) from the same form.
  const [isPack, setIsPack] = useState(false);
  const [scheduleId2, setScheduleId2] = useState<string | undefined>();
  const [price2, setPrice2] = useState<string>('');
  // Total handed over by the student in a pack; split across the two enrollments.
  const [totalReceived, setTotalReceived] = useState('');
  const [amount2, setAmount2] = useState('');

  // Inline "create student" form
  const [showNewStudent, setShowNewStudent] = useState(false);
  const [newDocType, setNewDocType] = useState<DocType>('dni');
  const [newDocNumber, setNewDocNumber] = useState('');
  const [newFirstName, setNewFirstName] = useState('');
  const [newLastName, setNewLastName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newSource, setNewSource] = useState<string | undefined>();
  const [newStudentNotes, setNewStudentNotes] = useState('');

  // Optional initial payment
  const [amount, setAmount] = useState('');
  const [installmentNumber, setInstallmentNumber] = useState('1');
  const [paymentMethod, setPaymentMethod] = useState<string | undefined>();
  const [hasReceipt, setHasReceipt] = useState(false);
  const [receiptNumber, setReceiptNumber] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');

  const createStudentMutation = useCreateStudent(client);
  const createEnrollmentMutation = useCreateEnrollment(client);
  const createPaymentMutation = useCreateStudentPayment(client);
  const isSubmitting =
    createStudentMutation.isPending ||
    createEnrollmentMutation.isPending ||
    createPaymentMutation.isPending;

  // Pack payment distribution (derived): what the student paid vs. how it's split.
  const packTotalReceived = Number.parseFloat(totalReceived) || 0;
  const amountBasico = Number.parseFloat(amount) || 0;
  const amountAvanzado = Number.parseFloat(amount2) || 0;
  const packRemaining = packTotalReceived - amountBasico - amountAvanzado;
  const packBalances = isPack && packTotalReceived > 0 && Math.abs(packRemaining) < 0.001;

  // Creates one initial payment; shared by both pack legs. `paymentMethod` is
  // guaranteed set by the caller (validated before any write in pack mode).
  async function createInitialPayment(enrollmentId: string, amt: number, note: string) {
    await createPaymentMutation.mutateAsync({
      enrollmentId,
      date: enrollmentDate,
      amount: amt,
      installmentNumber: 1,
      paymentMethod: paymentMethod as string,
      hasReceipt,
      receiptNumber: hasReceipt ? receiptNumber.trim() || null : null,
      notes: note,
    });
  }

  // Reset whenever the sheet re-opens so previous selections don't leak.
  useEffect(() => {
    if (open) {
      setStudentId(undefined);
      setScheduleId(undefined);
      setEnrollmentDate(toIsoDate(new Date()));
      setPrice("");
      setIsPack(false);
      setScheduleId2(undefined);
      setPrice2('');
      setTotalReceived('');
      setAmount2('');
      setShowNewStudent(false);
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
  }, [open]);

  function handleToggleNewStudent() {
    if (showNewStudent) {
      setShowNewStudent(false);
    } else {
      // Switching to "create new" clears any existing selection so the operator
      // doesn't accidentally submit a stale student id alongside the new form.
      setStudentId(undefined);
      setShowNewStudent(true);
    }
  }

  async function handleSubmit(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();

    if (!scheduleId) {
      toast.error('Selecciona un horario');
      return;
    }

    if (isPack) {
      if (!scheduleId2) {
        toast.error('Selecciona el segundo horario del pack');
        return;
      }
      if (scheduleId2 === scheduleId) {
        toast.error('Los dos horarios del pack deben ser distintos');
        return;
      }
    }

    // Resolve the student id: either pick the new one or use the selected.
    let resolvedStudentId: string | undefined = studentId;

    if (showNewStudent) {
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
        resolvedStudentId = created.id;
      } catch (err) {
        if (isConflict(err)) toast.error('Ya existe un alumno con ese documento');
        else if (isApiError(err)) toast.error(getApiErrorMessage(err));
        else toast.error('Error al crear alumno');
        return;
      }
    }

    if (!resolvedStudentId) {
      toast.error('Selecciona o crea un alumno');
      return;
    }

    // Pack payment distribution must reconcile before creating anything.
    if (isPack && packTotalReceived > 0) {
      if (!paymentMethod) {
        toast.error('Selecciona el medio de pago del pago inicial');
        return;
      }
      if (Math.abs(packRemaining) > 0.001) {
        toast.error('La distribución del pago no cuadra con el total recibido');
        return;
      }
    }

    // Create the first enrollment (Básico leg in a pack).
    let enrollmentId1: string;
    try {
      const enrollment = await createEnrollmentMutation.mutateAsync({
        studentId: resolvedStudentId,
        scheduleId,
        enrollmentDate,
        status: 'active',
        schedulePrice: price.trim() ? Number.parseFloat(price) : undefined,
      });
      enrollmentId1 = enrollment.id;
    } catch (err) {
      if (isConflict(err)) {
        toast.error('Ya existe una inscripción activa para este alumno en este horario');
      } else if (isApiError(err)) {
        toast.error(getApiErrorMessage(err));
      } else {
        toast.error('Error al crear inscripción');
      }
      return;
    }

    // Pack: create the second enrollment (Avanzado). If it fails, the first one
    // stays (no hard delete — project rule) and the operator finishes manually.
    let enrollmentId2: string | undefined;
    if (isPack) {
      try {
        const enrollment2 = await createEnrollmentMutation.mutateAsync({
          studentId: resolvedStudentId,
          scheduleId: scheduleId2 as string,
          enrollmentDate,
          status: 'active',
          schedulePrice: price2.trim() ? Number.parseFloat(price2) : undefined,
        });
        enrollmentId2 = enrollment2.id;
      } catch (err) {
        const detail = isConflict(err)
          ? 'ya existe una inscripción activa en ese horario'
          : isApiError(err)
            ? getApiErrorMessage(err)
            : 'error desconocido';
        toast.warning(
          `Se creó la inscripción de Básico, pero falló Avanzado: ${detail}. Complétala manualmente.`,
        );
        onSuccess?.();
        onOpenChange(false);
        return;
      }
    }

    // Pack: distribute the initial payment across both legs (2 payment records).
    if (isPack) {
      if (packTotalReceived > 0) {
        const packNote = paymentNotes.trim() || PACK_NOTE;
        const failures: string[] = [];
        if (amountBasico > 0) {
          try {
            await createInitialPayment(enrollmentId1, amountBasico, packNote);
          } catch {
            failures.push('Básico');
          }
        }
        if (amountAvanzado > 0 && enrollmentId2) {
          try {
            await createInitialPayment(enrollmentId2, amountAvanzado, packNote);
          } catch {
            failures.push('Avanzado');
          }
        }
        if (failures.length === 0) {
          toast.success('Pack matriculado y pago distribuido registrado');
        } else {
          toast.warning(`Pack matriculado, pero falló el pago de: ${failures.join(', ')}`);
        }
      } else {
        toast.success('Pack matriculado (sin pago inicial)');
      }
      onSuccess?.();
      onOpenChange(false);
      return;
    }

    // Single enrollment: optional initial payment (unchanged behavior).
    const amountNum = Number.parseFloat(amount);
    if (amount.trim() && amountNum > 0) {
      if (!paymentMethod) {
        toast.warning('Matrícula creada. Falta medio de pago: el pago inicial no se registró.');
        onSuccess?.();
        onOpenChange(false);
        return;
      }
      try {
        await createPaymentMutation.mutateAsync({
          enrollmentId: enrollmentId1,
          date: enrollmentDate,
          amount: amountNum,
          installmentNumber: Number.parseInt(installmentNumber, 10) || 1,
          paymentMethod,
          hasReceipt,
          receiptNumber: hasReceipt ? receiptNumber.trim() || null : null,
          notes: paymentNotes.trim() || null,
        });
        toast.success('Matrícula y pago inicial registrados');
      } catch (err) {
        const detail = isApiError(err) ? getApiErrorMessage(err) : 'error desconocido';
        toast.warning(`Matrícula creada, pero falló el pago inicial: ${detail}`);
      }
    } else {
      toast.success('Matrícula creada');
    }

    onSuccess?.();
    onOpenChange(false);
  }

  return (
    <FormSheetDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Nueva matrícula"
      description={isPack ? 'Matrícula en pack: Básico + Avanzado' : 'Matricula un alumno en un horario activo'}
      isLoading={isSubmitting}
      onSubmit={handleSubmit}
      submitLabel={isPack ? 'Matricular pack' : 'Matricular'}
    >
      {/* Pack toggle */}
      <div className="flex items-center justify-between rounded-md border p-3">
        <div className="space-y-0.5 pr-3">
          <Label htmlFor="packMode">Pack (Básico + Avanzado)</Label>
          <p className="text-xs text-muted-foreground">
            Matricula en dos horarios y distribuye un pago inicial entre ambos.
          </p>
        </div>
        <Switch
          id="packMode"
          checked={isPack}
          onCheckedChange={(checked) => {
            setIsPack(checked);
            if (checked && !paymentNotes.trim()) setPaymentNotes(PACK_NOTE);
            if (!checked && paymentNotes.trim() === PACK_NOTE) setPaymentNotes('');
          }}
        />
      </div>

      {/* Alumno */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Alumno</Label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleToggleNewStudent}
            className="h-7 text-xs"
          >
            {showNewStudent ? '← Buscar existente' : '+ Crear alumno'}
          </Button>
        </div>

        {!showNewStudent && (
          <StudentPicker
            client={client}
            value={studentId}
            onChange={setStudentId}
            name="studentId"
          />
        )}

        {showNewStudent && (
          <div className="space-y-3 rounded-md border p-3 bg-muted/30">
            <div className="text-xs text-muted-foreground">
              Completa los datos del nuevo alumno
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Tipo doc. <span className="text-destructive">*</span></Label>
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
                <Label htmlFor="newDocNumber">N° Documento <span className="text-destructive">*</span></Label>
                <Input
                  id="newDocNumber"
                  value={newDocNumber}
                  onChange={(e) => setNewDocNumber(e.target.value)}
                  placeholder="12345678"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="newFirstName">Nombre <span className="text-destructive">*</span></Label>
                <Input id="newFirstName" value={newFirstName} onChange={(e) => setNewFirstName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="newLastName">Apellido <span className="text-destructive">*</span></Label>
                <Input id="newLastName" value={newLastName} onChange={(e) => setNewLastName(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="newPhone">Teléfono</Label>
                <Input id="newPhone" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="newEmail">Email</Label>
                <Input
                  id="newEmail"
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
              <Label htmlFor="newStudentNotes">Notas alumno</Label>
              <Textarea
                id="newStudentNotes"
                value={newStudentNotes}
                onChange={(e) => setNewStudentNotes(e.target.value)}
                rows={2}
              />
            </div>
          </div>
        )}
      </div>

      {/* Horario */}
      <div className="space-y-2">
        <Label>{isPack ? 'Horario 1 · Básico' : 'Horario'}</Label>
        <SchedulePicker
          client={client}
          value={scheduleId}
          onChange={(id, schedule) => {
            setScheduleId(id);
            // Pre-fill the price with the schedule's list price; the operator can still edit it.
            setPrice(schedule.price.toString());
          }}
          name="scheduleId"
        />
      </div>

      {/* Precio (editable, default = precio del horario) */}
      <div className="space-y-2">
        <Label htmlFor="enrollmentPrice">{isPack ? 'Precio Básico (S/)' : 'Precio (S/)'}</Label>
        <Input
          id="enrollmentPrice"
          name="schedulePrice"
          type="number"
          min="0"
          step="0.01"
          placeholder="0.00"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          Por defecto es el precio del horario. Edítalo si acordaste un descuento o pack.
        </p>
      </div>

      {/* Segundo horario + precio (solo pack) */}
      {isPack && (
        <>
          <div className="space-y-2">
            <Label>Horario 2 · Avanzado</Label>
            <SchedulePicker
              client={client}
              value={scheduleId2}
              onChange={(id, schedule) => {
                setScheduleId2(id);
                setPrice2(schedule.price.toString());
              }}
              name="scheduleId2"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="enrollmentPrice2">Precio Avanzado (S/)</Label>
            <Input
              id="enrollmentPrice2"
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={price2}
              onChange={(e) => setPrice2(e.target.value)}
            />
          </div>
        </>
      )}

      {/* Fecha de inscripción */}
      <div className="space-y-2">
        <Label htmlFor="enrollmentDate">Fecha de inscripción</Label>
        <Input
          id="enrollmentDate"
          name="enrollmentDate"
          type="date"
          value={enrollmentDate}
          onChange={(e) => setEnrollmentDate(e.target.value)}
          required
        />
      </div>

      {/* Pago inicial (opcional) */}
      <div className="border-t pt-4 space-y-3">
        <div className="text-sm font-medium">Pago inicial (opcional)</div>
        {isPack ? (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="totalReceived">Total recibido (S/)</Label>
              <Input
                id="totalReceived"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={totalReceived}
                onChange={(e) => setTotalReceived(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="amountBasico">→ Básico (S/)</Label>
                <Input
                  id="amountBasico"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="amountAvanzado">→ Avanzado (S/)</Label>
                <Input
                  id="amountAvanzado"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={amount2}
                  onChange={(e) => setAmount2(e.target.value)}
                />
              </div>
            </div>
            {packTotalReceived > 0 && (
              <p
                className={cn(
                  'text-xs',
                  packBalances ? 'text-muted-foreground' : 'text-destructive',
                )}
              >
                {packBalances
                  ? 'Distribución completa ✓'
                  : `Restante por asignar: S/ ${packRemaining.toFixed(2)}`}
              </p>
            )}
          </>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="paymentAmount">Monto (S/)</Label>
              <Input
                id="paymentAmount"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="paymentInstallment">Cuota N°</Label>
              <Input
                id="paymentInstallment"
                type="number"
                min="1"
                value={installmentNumber}
                onChange={(e) => setInstallmentNumber(e.target.value)}
              />
            </div>
          </div>
        )}
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
            <Label htmlFor="paymentReceiptNumber">N° Boleta</Label>
            <Input
              id="paymentReceiptNumber"
              value={receiptNumber}
              onChange={(e) => setReceiptNumber(e.target.value)}
              placeholder="B001-00123"
            />
          </div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="paymentNotes">Notas</Label>
          <Textarea
            id="paymentNotes"
            value={paymentNotes}
            onChange={(e) => setPaymentNotes(e.target.value)}
            rows={2}
          />
        </div>
      </div>
    </FormSheetDialog>
  );
}
