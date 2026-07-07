'use client';

/**
 * EnrollmentPaymentsBlock — shows enrollment-scoped payment history and
 * exposes an inline "register payment" flow.
 *
 * Uses GET /enrollments/{id}/payments so the enrollment becomes the
 * operational payment hub directly from the enrollments context.
 */

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Trash2 } from 'lucide-react';
import { ConfirmDeleteDialog } from '@/components/data';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { CatalogSelect } from '@/components/pickers';
import { useApiClient } from '@/hooks/use-api-client';
import {
  flattenInfiniteItems,
  getInfiniteTotal,
  useInfiniteEnrollmentPayments,
  useCreateStudentPayment,
  useDeleteStudentPayment,
} from '@/hooks';
import { formatTableDate } from '@/lib/dates';
import { toIsoDate } from '@/lib/dashboard-period';
import { getApiErrorMessage, isApiError } from '@/lib/api';
import { formatCurrency, subtractMoney, sumMoney } from '@/lib/money';
import type { StudentPayment } from '@/lib/api';

export interface EnrollmentPaymentSummary {
  enrollmentId: string;
  totalPaid: number;
  schedulePrice: number | null;
  pendingAmount: number | null;
  paymentCount: number;
  highestInstallment: number;
}

interface EnrollmentPaymentsBlockProps {
  enrollmentId: string;
  schedulePrice?: number;
  onSummaryChange?: (summary: EnrollmentPaymentSummary) => void;
}

export function EnrollmentPaymentsBlock({
  enrollmentId,
  schedulePrice,
  onSummaryChange,
}: EnrollmentPaymentsBlockProps) {
  const client = useApiClient();
  const paymentParams = useMemo(() => ({ limit: 25 }), []);

  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    refetch,
  } = useInfiniteEnrollmentPayments(
    client,
    enrollmentId,
    paymentParams,
    { enabled: !!enrollmentId },
  );

  useEffect(() => {
    if (!enrollmentId || !hasNextPage || isFetchingNextPage) return;
    fetchNextPage();
  }, [enrollmentId, hasNextPage, isFetchingNextPage, fetchNextPage]);

  const payments = useMemo<StudentPayment[]>(
    () => flattenInfiniteItems(data, { sortBy: (payment) => payment.date }),
    [data],
  );
  const totalPayments = getInfiniteTotal(data);
  const totalPaid = useMemo(
    () => sumMoney(payments.map((payment) => payment.amount)),
    [payments],
  );
  const pendingAmount = useMemo(() => {
    if (schedulePrice === undefined) return undefined;
    return Math.max(0, subtractMoney(schedulePrice, totalPaid));
  }, [schedulePrice, totalPaid]);
  const installmentNumbers = useMemo(
    () => Array.from(new Set(payments.map((payment) => payment.installmentNumber))).sort((a, b) => a - b),
    [payments],
  );
  const highestInstallment = installmentNumbers[installmentNumbers.length - 1] ?? 0;
  const nextInstallment = String(highestInstallment + 1);
  const isSyncingAllPayments = !!hasNextPage || isFetchingNextPage;

  useEffect(() => {
    if (!onSummaryChange) return;
    onSummaryChange({
      enrollmentId,
      totalPaid,
      schedulePrice: schedulePrice ?? null,
      pendingAmount: pendingAmount ?? null,
      paymentCount: payments.length,
      highestInstallment,
    });
  }, [
    enrollmentId,
    onSummaryChange,
    totalPaid,
    schedulePrice,
    pendingAmount,
    payments.length,
    highestInstallment,
  ]);

  const createMutation = useCreateStudentPayment(client);
  const deleteMutation = useDeleteStudentPayment(client);

  const [showForm, setShowForm] = useState(false);
  const [paymentToDelete, setPaymentToDelete] = useState<StudentPayment | null>(null);
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
    setShowForm((value) => !value);
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

    const normalizedAmount = sumMoney([amountNum]);
    const installmentNum = Number.parseInt(installmentNumber, 10);
    if (!Number.isInteger(installmentNum) || installmentNum < 1) {
      toast.error('Ingresa un N° de cuota válido (>= 1)');
      return;
    }
    const duplicatedInstallment = payments.some((payment) => payment.installmentNumber === installmentNum);
    if (duplicatedInstallment) {
      toast.error(`La cuota ${installmentNum} ya está registrada para esta inscripción`);
      return;
    }
    const normalizedReceiptNumber = receiptNumber.trim();
    if (hasReceipt && !normalizedReceiptNumber) {
      toast.error('Ingresa el N° de boleta');
      return;
    }
    const duplicatedReceipt = hasReceipt && payments.some((payment) =>
      payment.hasReceipt &&
      payment.receiptNumber?.trim().toLowerCase() === normalizedReceiptNumber.toLowerCase()
    );
    if (duplicatedReceipt) {
      toast.error(`La boleta "${normalizedReceiptNumber}" ya está registrada para esta inscripción`);
      return;
    }

    try {
      await createMutation.mutateAsync({
        enrollmentId,
        date,
        amount: normalizedAmount,
        installmentNumber: installmentNum,
        paymentMethod,
        hasReceipt,
        receiptNumber: hasReceipt ? normalizedReceiptNumber : null,
        notes: notes.trim() || null,
      });
      await refetch();
      toast.success('Pago registrado');
      setShowForm(false);
      resetForm();
    } catch (err) {
      const detail = isApiError(err) ? getApiErrorMessage(err) : 'error desconocido';
      toast.error(`Error al registrar pago: ${detail}`);
    }
  }

  async function confirmDeletePayment() {
    if (!paymentToDelete) return;
    try {
      await deleteMutation.mutateAsync(paymentToDelete.id);
      await refetch();
      toast.success('Pago eliminado');
      setPaymentToDelete(null);
    } catch (err) {
      const detail = isApiError(err) ? getApiErrorMessage(err) : 'error desconocido';
      toast.error(`Error al eliminar: ${detail}`);
    }
  }

  return (
    <div className="space-y-3 border-t pt-4">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium">Pagos de esta inscripción</div>
        <Button type="button" variant="ghost" size="sm" onClick={handleToggleForm} className="h-7 text-xs">
          {showForm ? '× Cancelar' : '+ Registrar pago'}
        </Button>
      </div>

      <div className="grid gap-2 text-sm sm:grid-cols-4">
        <div className="rounded-md border bg-background p-2">
          <p className="text-xs text-muted-foreground">Precio</p>
          <p className="font-medium tabular-nums">
            {schedulePrice === undefined ? '—' : formatCurrency(schedulePrice)}
          </p>
        </div>
        <div className="rounded-md border bg-background p-2">
          <p className="text-xs text-muted-foreground">Pagado</p>
          <p className="font-medium tabular-nums">{formatCurrency(totalPaid)}</p>
        </div>
        <div className="rounded-md border bg-background p-2">
          <p className="text-xs text-muted-foreground">Pendiente</p>
          <p className="font-medium tabular-nums">
            {pendingAmount === undefined ? '—' : formatCurrency(pendingAmount)}
          </p>
        </div>
        <div className="rounded-md border bg-background p-2">
          <p className="text-xs text-muted-foreground">Cuotas</p>
          <p className="font-medium">
            {installmentNumbers.length === 0 ? 'Sin pagos' : `${installmentNumbers.length} registradas`}
          </p>
          {highestInstallment > 0 && (
            <p className="text-xs text-muted-foreground">Máxima: #{highestInstallment}</p>
          )}
        </div>
      </div>

      <div className="space-y-1 rounded-md border bg-background p-2">
        <p className="text-xs text-muted-foreground">Progresión de cuotas</p>
        {installmentNumbers.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin cuotas registradas.</p>
        ) : (
          <div className="flex flex-wrap gap-1">
            {installmentNumbers.map((installment) => (
              <Badge key={installment} variant="secondary">#{installment}</Badge>
            ))}
          </div>
        )}
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" /> Cargando pagos...
        </div>
      )}

      {!isLoading && isSyncingAllPayments && (
        <p className="text-sm text-muted-foreground">Sincronizando historial completo de pagos...</p>
      )}

      {!isLoading && payments.length === 0 && !showForm && (
        <div className="text-sm text-muted-foreground">Esta inscripción todavía no tiene pagos registrados.</div>
      )}

      {payments.length > 0 && (
        <>
          <div className="divide-y rounded-md border">
            {payments.map((payment) => (
              <div key={payment.id} className="flex items-start justify-between gap-3 p-2.5 text-sm">
                <div className="min-w-0 space-y-0.5">
                  <div className="font-medium">
                    {formatCurrency(payment.amount)} · Cuota {payment.installmentNumber}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatTableDate(payment.date)} · {payment.paymentMethod}
                    {payment.hasReceipt ? ` · Boleta ${payment.receiptNumber ?? ''}` : ''}
                  </div>
                  {payment.notes && (
                    <div className="truncate text-xs text-muted-foreground">{payment.notes}</div>
                  )}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setPaymentToDelete(payment)}
                  disabled={deleteMutation.isPending}
                  className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                  title="Eliminar pago"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Mostrando {payments.length} de {totalPayments} pagos.
          </p>
        </>
      )}

      {showForm && (
        <div className="space-y-3 rounded-md border bg-muted/30 p-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="epbDate">Fecha</Label>
              <Input id="epbDate" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="epbInstallment">Cuota N°</Label>
              <Input
                id="epbInstallment"
                type="number"
                min="1"
                value={installmentNumber}
                onChange={(event) => setInstallmentNumber(event.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="epbAmount">Monto (S/) <span className="text-destructive">*</span></Label>
              <Input
                id="epbAmount"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
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
              <Label htmlFor="epbReceiptNumber">N° Boleta</Label>
              <Input
                id="epbReceiptNumber"
                value={receiptNumber}
                onChange={(event) => setReceiptNumber(event.target.value)}
                placeholder="B001-00123"
              />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="epbNotes">Notas</Label>
            <Textarea id="epbNotes" value={notes} onChange={(event) => setNotes(event.target.value)} rows={2} />
          </div>
          <Button
            type="button"
            onClick={handleRegister}
            disabled={createMutation.isPending || isSyncingAllPayments}
            className="w-full"
          >
            {(createMutation.isPending || isSyncingAllPayments) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isSyncingAllPayments ? 'Sincronizando historial...' : 'Registrar pago'}
          </Button>
        </div>
      )}

      <ConfirmDeleteDialog
        open={paymentToDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPaymentToDelete(null);
        }}
        onConfirm={confirmDeletePayment}
        title="¿Eliminar pago?"
        description={paymentToDelete
          ? `Se eliminará el pago de ${formatCurrency(paymentToDelete.amount)} (cuota ${paymentToDelete.installmentNumber}). Esta acción se puede revertir.`
          : undefined}
        confirmLabel="Eliminar"
        loadingLabel="Eliminando..."
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
