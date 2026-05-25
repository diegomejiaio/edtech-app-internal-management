'use client';

/**
 * QuickEnrollmentSheet — inline enrollment creation from the dashboard.
 *
 * Mirrors the create flow on /enrollments but skipped to the minimum fields
 * needed for a fast capture (alumno, horario, fecha = today, status = active).
 * Defaults to today's date and `active` status so the operator only picks
 * student + schedule in the common case.
 */

import { useEffect, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { FormSheetDialog } from '@/components/data';
import { StudentPicker, SchedulePicker } from '@/components/pickers';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCreateEnrollment } from '@/hooks';
import {
  isApiError,
  isConflict,
  getApiErrorMessage,
  type ApiClient,
  type EnrollmentBody,
} from '@/lib/api';
import { toIsoDate } from '@/lib/dashboard-period';

interface QuickEnrollmentSheetProps {
  client: ApiClient;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function QuickEnrollmentSheet({
  client,
  open,
  onOpenChange,
}: QuickEnrollmentSheetProps) {
  const createMutation = useCreateEnrollment(client);
  const [studentId, setStudentId] = useState<string | undefined>();
  const [scheduleId, setScheduleId] = useState<string | undefined>();

  // Reset pickers whenever the sheet re-opens so previous selections
  // don't leak into a new enrollment.
  useEffect(() => {
    if (open) {
      setStudentId(undefined);
      setScheduleId(undefined);
    }
  }, [open]);

  function handleSubmit(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();

    if (!studentId || !scheduleId) {
      toast.error('Selecciona alumno y horario');
      return;
    }

    const fd = new FormData(ev.currentTarget);
    const body: EnrollmentBody = {
      studentId,
      scheduleId,
      enrollmentDate: (fd.get('enrollmentDate') as string) || toIsoDate(new Date()),
      status: 'active',
    };

    createMutation
      .mutateAsync(body)
      .then(() => {
        toast.success('Matrícula creada');
        onOpenChange(false);
      })
      .catch((err) => {
        if (isConflict(err)) {
          toast.error('Ya existe una inscripción activa para este alumno en este horario');
        } else if (isApiError(err)) {
          toast.error(getApiErrorMessage(err));
        } else {
          toast.error('Error inesperado');
        }
      });
  }

  return (
    <FormSheetDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Nueva matrícula"
      description="Matricula un alumno en un horario activo"
      isLoading={createMutation.isPending}
      onSubmit={handleSubmit}
      submitLabel="Matricular"
    >
      <div className="space-y-2">
        <Label>Alumno</Label>
        <StudentPicker
          client={client}
          value={studentId}
          onChange={setStudentId}
          name="studentId"
        />
      </div>
      <div className="space-y-2">
        <Label>Horario</Label>
        <SchedulePicker
          client={client}
          value={scheduleId}
          onChange={setScheduleId}
          name="scheduleId"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="enrollmentDate">Fecha de inscripción</Label>
        <Input
          id="enrollmentDate"
          name="enrollmentDate"
          type="date"
          defaultValue={toIsoDate(new Date())}
          required
        />
      </div>
    </FormSheetDialog>
  );
}
