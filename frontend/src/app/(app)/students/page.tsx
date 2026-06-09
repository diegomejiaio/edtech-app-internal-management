'use client';

/**
 * Students list page — M3.
 *
 * CRUD list with search, pagination, create/edit dialog, soft-delete.
 */

import { useMemo, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useApiClient } from '@/hooks/use-api-client';
import { flattenInfiniteItems, getInfiniteTotal, useInfiniteStudents, useCreateStudent, useUpdateStudent, useDeleteStudent } from '@/hooks';
import { PageHeader, DataTable, RowActions, SearchBar, FormSheetDialog, ConfirmDeleteDialog, type Column } from '@/components/data';
import { CatalogSelect } from '@/components/pickers';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { getApiErrorMessage, isApiError, isConflict, DOC_TYPE_LABELS } from '@/lib/api';
import type { Student, StudentBody, DocType } from '@/lib/api';

const DOC_TYPES: DocType[] = ['dni', 'ce', 'passport'];

const columns: Column<Student>[] = [
  { key: 'code', header: 'Código', cell: (s) => s.code ? <span className="font-mono text-xs font-medium">{s.code}</span> : '—' },
  { key: 'name', header: 'Nombre', cell: (s) => `${s.firstName} ${s.lastName}` },
  { key: 'doc', header: 'Documento', cell: (s) => `${DOC_TYPE_LABELS[s.docType]} ${s.docNumber}` },
  { key: 'phone', header: 'Teléfono', cell: (s) => s.phone ?? '—' },
  { key: 'email', header: 'Email', cell: (s) => s.email ?? '—' },
  {
    key: 'active',
    header: 'Estado',
    cell: (s) => (
      <Badge variant={s.active ? 'default' : 'secondary'}>
        {s.active ? 'Activo' : 'Inactivo'}
      </Badge>
    ),
  },
];

export default function StudentsPage() {
  const client = useApiClient();
  const router = useRouter();
  const [search, setSearch] = useState('');
  const limit = 25;

  const { data, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } = useInfiniteStudents(client, {
    search: search || undefined,
    limit,
  });
  const students = useMemo(() => flattenInfiniteItems(data, { sortBy: (s) => s.updatedAt ?? s.createdAt }), [data]);
  const total = getInfiniteTotal(data);
  const createMutation = useCreateStudent(client);
  const updateMutation = useUpdateStudent(client);
  const deleteMutation = useDeleteStudent(client);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Student | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Student | null>(null);
  const [pickedSource, setPickedSource] = useState<string | undefined>();

  function openCreate() {
    setEditing(null);
    setPickedSource(undefined);
    setFormOpen(true);
  }

  function openEdit(student: Student) {
    setEditing(student);
    setPickedSource(student.source ?? undefined);
    setFormOpen(true);
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const body: StudentBody = {
      firstName: fd.get('firstName') as string,
      lastName: fd.get('lastName') as string,
      docType: fd.get('docType') as DocType,
      docNumber: fd.get('docNumber') as string,
      phone: (fd.get('phone') as string) || null,
      email: (fd.get('email') as string) || null,
      source: pickedSource || null,
      notes: (fd.get('notes') as string) || null,
    };

    const mutation = editing
      ? updateMutation.mutateAsync({ id: editing.id, body, ifMatch: editing._etag })
      : createMutation.mutateAsync(body);

    mutation
      .then(() => {
        setFormOpen(false);
        toast.success(editing ? 'Alumno actualizado' : 'Alumno creado');
      })
      .catch((err) => {
        if (isConflict(err)) toast.error('Ya existe un alumno con ese documento');
        else if (isApiError(err)) toast.error(getApiErrorMessage(err));
        else toast.error('Error inesperado');
      });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Alumnos"
        description="Gestión de alumnos registrados"
        action={<Button onClick={openCreate}>Nuevo alumno</Button>}
      />

      <SearchBar
        placeholder="Buscar por nombre, documento o teléfono..."
        value={search}
        onChange={setSearch}
      />

      <DataTable
        columns={columns}
        data={students}
        total={total}
        hasNextPage={hasNextPage}
        onLoadMore={() => fetchNextPage()}
        rowKey={(s) => s.id}
        isLoading={isLoading}
        isFetchingNextPage={isFetchingNextPage}
        actions={(s) => (
          <RowActions
            onView={() => router.push(`/students/detail?id=${s.id}`)}
            onEdit={() => openEdit(s)}
            onDelete={() => setDeleteTarget(s)}
          />
        )}
      />

      {/* Create / Edit sheet */}
      <FormSheetDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        title={editing ? 'Editar alumno' : 'Nuevo alumno'}
        isLoading={createMutation.isPending || updateMutation.isPending}
        onSubmit={handleSubmit}
      >
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="firstName">Nombre</Label>
            <Input id="firstName" name="firstName" defaultValue={editing?.firstName} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lastName">Apellido</Label>
            <Input id="lastName" name="lastName" defaultValue={editing?.lastName} required />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="docType">Tipo documento</Label>
            <Select name="docType" defaultValue={editing?.docType ?? 'dni'}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {DOC_TYPES.map((dt) => <SelectItem key={dt} value={dt}>{DOC_TYPE_LABELS[dt]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="docNumber">N° Documento</Label>
            <Input id="docNumber" name="docNumber" defaultValue={editing?.docNumber} required />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="phone">Teléfono</Label>
            <Input id="phone" name="phone" defaultValue={editing?.phone ?? ''} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" defaultValue={editing?.email ?? ''} />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="notes">Notas</Label>
          <Input id="notes" name="notes" defaultValue={editing?.notes ?? ''} />
        </div>
        <div className="space-y-2">
          <Label>Fuente</Label>
          <CatalogSelect client={client} catalogCode="studentSources" value={pickedSource} onChange={setPickedSource} placeholder="¿Cómo nos encontró?" />
        </div>
      </FormSheetDialog>

      {/* Delete confirmation */}
      <ConfirmDeleteDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) {
            deleteMutation.mutateAsync(deleteTarget.id)
              .then(() => { setDeleteTarget(null); toast.success('Alumno eliminado'); })
              .catch((err) => {
                if (isConflict(err)) toast.error('No se puede eliminar: tiene inscripciones activas');
                else toast.error('Error al eliminar');
              });
          }
        }}
        entityName={deleteTarget ? `${deleteTarget.firstName} ${deleteTarget.lastName}` : undefined}
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
