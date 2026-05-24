'use client';

import { Eye, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface RowActionsProps {
  onView?: () => void;
  onEdit: () => void;
  onDelete: () => void;
  viewLabel?: string;
  editLabel?: string;
  deleteLabel?: string;
}

export function RowActions({
  onView,
  onEdit,
  onDelete,
  viewLabel = 'Ver detalle',
  editLabel = 'Editar',
  deleteLabel = 'Eliminar',
}: RowActionsProps) {
  return (
    <div className="flex justify-end gap-1">
      {onView && (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={viewLabel}
          title={viewLabel}
          onClick={onView}
        >
          <Eye />
        </Button>
      )}
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={editLabel}
        title={editLabel}
        onClick={onEdit}
      >
        <Pencil />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="text-destructive hover:text-destructive"
        aria-label={deleteLabel}
        title={deleteLabel}
        onClick={onDelete}
      >
        <Trash2 />
      </Button>
    </div>
  );
}
