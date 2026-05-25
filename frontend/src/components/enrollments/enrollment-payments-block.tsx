'use client';

/**
 * EnrollmentPaymentsBlock — lists existing payments for an enrollment and
 * exposes an inline "register a new payment" form.
 *
 * Used inside the edit-enrollment sheet so operators can see/manage the
 * initial payment captured at creation time (which lives on a separate
 * StudentPayment record, not on the Enrollment itself).
 */

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { CatalogSelect } from '@/components/pickers';
import { useApiClient } from '@/hooks/use-api-client';
import {
  useStudentPayments,
  useCreateStudentPayment,
  useDeleteStudentPayment,
} from '@/hooks';
import { formatTableDate } from '@/lib/dates';
import { toIsoDate } from '@/lib/dashboard-period';
import { getApiErrorMessage, isApiError } from '@/lib/api';
import type { StudentPayment } from '@/lib/api';

interface EnrollmentPaymentsBlockProps {
  enrollmentId: string;
}

export function EnrollmentPaymentsBlock({ enrollmentId }: EnrollmentPaymentsBlockProps) {
  const client = useApiClient();

  const { data, isLoading } = useStudentPayments(client, {
    enrollmentId,
    limit: 20,
  });
  const payments = useMemo<StudentPayment[]>(() => data?.items ?? [], [data]);
  const nextInstallment = useMemo(() => {
    const max = payments.reduce((m, p) => Math.max(m, p.installmentNumber), 0);
    return String(max + 1);
  }, [payments]);

  const createMutation = useCreateStudentPayment(client);
  const deleteMutation = useDeleteStudentPayment(client);

  const [showForm, setShowForm] = useState(false);
  const [date, setDate] = useState(toIsoDate(new Date()));
  const [amount, setAmount] = useState('');
  const [installmentNumber, setInstallmentNumber] = useState(nextInstallment);
  const [paymentMethod, setPaymentMethod] = useState<string | undefined>();
  const [hasReceipt, setHasReceipt] = useState(false);
  const [receiptNumber, setReceiptNumber] = useState('');
  const [notes, setNotes] = useState('');

  function resetForm() {
    setDate(toIsoDate(new Date()));
    setAmount('');
    setInstallmentNumber(nextInstallment);
    setPaymentMethod(undefined);
    setHasReceipt(false);
    setReceiptNumber('');
    setNotes('');
  }

  function handleToggleForm() {
    if (!showForm) {
      resetForm();
      setInstallmentNumber(nextInstallment);
    }
    setShowForm((v) => !v);
  }

  async function handleRegister() {
    const amountNum = Number.parseFloat(amount);
    if (!amount.trim() || amountNum <= 0) {
      toast.error('Monto requerido (> 0)');
      return;
    }
    if (!paymentMethod) {
      toast.error('Selecciona un medio de pago');
      return;
    }
    try {
      await createMutation.mutateAsync({
        enrollmentId,
        date,
        amount: amountNum,
        installmentNumber: Number.parseInt(installmentNumber, 10) || 1,
        paymentMethod,
        hasReceipt,
        receiptNumber: hasReceipt ? receiptNumber.trim() || null : null,
        notes: notes.trim() || null,
      });
      toast.success('Pago registrado');
      setShowForm(false);
      resetForm();
    } catch (err) {
      const detail = isApiError(err) ? getApiErrorMessage(err) : 'error desconocido';
      toast.error(`Error al registrar pago: ${detail}`);
    }
  }

  async function handleDelete(p: StudentPayment) {
    if (!confirm(`Eliminar pago de S/ ${p.amount.toFixed(2)} (cuota ${p.installmentNumber})?`)) return;
    try {
      await deleteMutation.mutateAsync(p.id);
      toast.success('Pago eliminado');
    } catch (err) {
      const detail = isApiError(err) ? getApiErrorMessage(err) : 'error desconocido';
      toast.error(`Error al eliminar: ${detail}`);
    }
  }

  return (
    <div className="border-t pt-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium">Pagos de esta inscripción</div>
        <Button type="button" variant="ghost" size="sm" onClick={handleToggleForm} className="h-7 text-xs">
          {showForm ? '× Cancelar' : '+ Registrar pago'}
        </Button>
      </div>

      {isLoading && (
        <div className="text-sm text-muted-foreground flex items-center gap-2">
          <Loader2 className="h-3 w-3 animate-spin" /> Cargando pagos…
        </div>
      )}

      {!isLoading && payments.length === 0 && !showForm && (
        <div className="text-sm text-muted-foreground">Sin pagos registrados.</div>
      )}

      {payments.length > 0 && (
        <div className="rounded-md border divide-y">
          {payments.map((p) => (
            <div key={p.id} className="p-2.5 text-sm flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-0.5">
                <div className="font-medium">
                  S/ {p.amount.toFixed(2)} · Cuota {p.installmentNumber}
                </div>
                <div className="text-xs text-muted-foreground">
                  {formatTableDate(p.date)} · {p.paymentMethod}
                  {p.hasReceipt ? ` · Boleta ${p.receiptNumber ?? ''}` : ''}
                </div>
                {p.notes && (
                  <div className="text-xs text-muted-foreground truncate">{p.notes}</div>
                )}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleDelete(p)}
                disabled={deleteMutation.isPending}
                className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                title="Eliminar pago"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="space-y-3 rounded-md border p-3 bg-muted/30">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Fecha</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
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
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Monto (S/) <span className="text-destructive">*</span></Label>
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
              <Label>Medio de pago <span className="text-destructive">*</span></Label>
              <CatalogSelect
                client={client}
                catalogCode="paymentMethods"
                value={paymentMethod}
                onChange={setPaymentMethod}
                placeholder="Seleccionar..."
              />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="hasReceiptEdit">Boleta</Label>
            <Switch id="hasReceiptEdit" checked={hasReceipt} onCheckedChange={setHasReceipt} />
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
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
          <Button
            type="button"
            onClick={handleRegister}
            disabled={createMutation.isPending}
            className="w-full"
          >
            {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Registrar pago
          </Button>
        </div>
      )}
    </div>
  );
}
