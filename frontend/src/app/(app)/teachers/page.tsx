'use client';

/**
 * Teachers list page — M2.
 *
 * CRUD list with search, pagination, create/edit dialog, soft-delete.
 */

import { useMemo, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { useApiClient } from '@/hooks/use-api-client';
import { flattenInfiniteItems, getInfiniteTotal, useInfiniteTeachers, useCreateTeacher, useUpdateTeacher, useDeleteTeacher } from '@/hooks';
import { PageHeader, DataTable, SearchBar, FormSheetDialog, ConfirmDeleteDialog, type Column } from '@/components/data';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { isApiError, isConflict, DOC_TYPE_LABELS } from '@/lib/api';
import type { Teacher, TeacherBody, DocType } from '@/lib/api';

const DOC_TYPES: DocType[] = ['dni', 'ce', 'passport'];

const columns: Column<Teacher>[] = [
  { key: 'name', header: 'Nombre', cell: (t) => `${t.firstName} ${t.lastName}` },
  { key: 'doc', header: 'Documento', cell: (t) => `${DOC_TYPE_LABELS[t.docType]} ${t.docNumber}` },
  { key: 'specialty', header: 'Especialidad', cell: (t) => t.specialty ?? '—' },
  { key: 'phone', header: 'Teléfono', cell: (t) => t.phone ?? '—' },
  {
    key: 'active',
    header: 'Estado',
    cell: (t) => (
      <Badge variant={t.active ? 'default' : 'secondary'}>
        {t.active ? 'Activo' : 'Inactivo'}
      </Badge>
    ),
  },
];

export default function TeachersPage() {
  const client = useApiClient();
  const [search, setSearch] = useState('');
  const limit = 25;

  const { data, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } = useInfiniteTeachers(client, {
    search: search || undefined,
    limit,
  });
  const teachers = useMemo(() => flattenInfiniteItems(data), [data]);
  const total = getInfiniteTotal(data);
  const createMutation = useCreateTeacher(client);
  const updateMutation = useUpdateTeacher(client);
  const deleteMutation = useDeleteTeacher(client);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Teacher | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Teacher | null>(null);

  function openCreate() { setEditing(null); setFormOpen(true); }
  function openEdit(teacher: Teacher) { setEditing(teacher); setFormOpen(true); }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const body: TeacherBody = {
      firstName: fd.get('firstName') as string,
      lastName: fd.get('lastName') as string,
      docType: fd.get('docType') as DocType,
      docNumber: fd.get('docNumber') as string,
      phone: (fd.get('phone') as string) || null,
      email: (fd.get('email') as string) || null,
      specialty: (fd.get('specialty') as string) || null,
    };

    const mutation = editing
      ? updateMutation.mutateAsync({ id: editing.id, body, ifMatch: editing._etag })
      : createMutation.mutateAsync(body);

    mutation
      .then(() => {
        setFormOpen(false);
        toast.success(editing ? 'Profesor actualizado' : 'Profesor creado');
      })
      .catch((err) => {
        if (isConflict(err)) toast.error('Ya existe un profesor con ese documento');
        else if (isApiError(err)) toast.error(err.problem.detail ?? err.message);
        else toast.error('Error inesperado');
      });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Profesores"
        description="Gestión de profesores"
        action={<Button onClick={openCreate}>Nuevo profesor</Button>}
      />

      <SearchBar
        placeholder="Buscar por nombre o documento..."
        value={search}
        onChange={setSearch}
      />

      <DataTable
        columns={columns}
        data={teachers}
        total={total}
        hasNextPage={hasNextPage}
        onLoadMore={() => fetchNextPage()}
        rowKey={(t) => t.id}
        isLoading={isLoading}
        isFetchingNextPage={isFetchingNextPage}
        actions={(t) => (
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" onClick={() => openEdit(t)}>Editar</Button>
            <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setDeleteTarget(t)}>Eliminar</Button>
          </div>
        )}
      />

      {/* Create / Edit sheet */}
      <FormSheetDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        title={editing ? 'Editar profesor' : 'Nuevo profesor'}
        isLoading={createMutation.isPending || updateMutation.isPending}
        onSubmit={handleSubmit}
      >
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2"><Label htmlFor="firstName">Nombre</Label><Input id="firstName" name="firstName" defaultValue={editing?.firstName} required /></div>
          <div className="space-y-2"><Label htmlFor="lastName">Apellido</Label><Input id="lastName" name="lastName" defaultValue={editing?.lastName} required /></div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="docType">Tipo documento</Label>
            <Select name="docType" defaultValue={editing?.docType ?? 'dni'}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{DOC_TYPES.map((dt) => <SelectItem key={dt} value={dt}>{DOC_TYPE_LABELS[dt]}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2"><Label htmlFor="docNumber">N° Documento</Label><Input id="docNumber" name="docNumber" defaultValue={editing?.docNumber} required /></div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2"><Label htmlFor="phone">Teléfono</Label><Input id="phone" name="phone" defaultValue={editing?.phone ?? ''} /></div>
          <div className="space-y-2"><Label htmlFor="email">Email</Label><Input id="email" name="email" type="email" defaultValue={editing?.email ?? ''} /></div>
        </div>
        <div className="space-y-2"><Label htmlFor="specialty">Especialidad</Label><Input id="specialty" name="specialty" defaultValue={editing?.specialty ?? ''} /></div>
      </FormSheetDialog>

      <ConfirmDeleteDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutateAsync(deleteTarget.id)
          .then(() => { setDeleteTarget(null); toast.success('Profesor eliminado'); })
          .catch((err) => {
            if (isConflict(err)) toast.error('No se puede eliminar: tiene horarios activos');
            else toast.error('Error al eliminar');
          })
        }
        entityName={deleteTarget ? `${deleteTarget.firstName} ${deleteTarget.lastName}` : undefined}
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
