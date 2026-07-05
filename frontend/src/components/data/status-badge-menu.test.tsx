/**
 * Behavior guard for the inline status editor.
 *
 * Non-terminal transitions apply immediately; terminal transitions (e.g.
 * finished/cancelled) must open a confirmation dialog and only fire `onChange`
 * after the user confirms. This protects the team from destructive misclicks.
 */

import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StatusBadgeMenu } from './status-badge-menu';
import type { StatusOption } from './status-multi-select';

type Status = 'active' | 'inProgress' | 'finished' | 'cancelled';

const OPTIONS: StatusOption<Status>[] = [
  { value: 'active', label: 'Activo' },
  { value: 'inProgress', label: 'En progreso' },
  { value: 'finished', label: 'Finalizado' },
  { value: 'cancelled', label: 'Cancelado' },
];

const VARIANTS = {
  active: 'default',
  inProgress: 'info',
  finished: 'secondary',
  cancelled: 'destructive',
} as const;

function renderMenu(onChange: (s: Status) => void) {
  return render(
    <StatusBadgeMenu
      value="active"
      options={OPTIONS}
      variants={VARIANTS}
      terminalStatuses={['finished', 'cancelled']}
      onChange={onChange}
    />,
  );
}

describe('StatusBadgeMenu', () => {
  it('applies a non-terminal status immediately without confirmation', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderMenu(onChange);

    await user.click(screen.getByText('Activo'));
    await user.click(await screen.findByText('En progreso'));

    expect(onChange).toHaveBeenCalledWith('inProgress');
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('requires confirmation before applying a terminal status', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderMenu(onChange);

    await user.click(screen.getByText('Activo'));
    await user.click(await screen.findByText('Cancelado'));

    // Dialog opens; onChange must NOT have fired yet.
    expect(await screen.findByRole('alertdialog')).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Confirmar' }));
    expect(onChange).toHaveBeenCalledWith('cancelled');
  });

  it('does not apply a terminal status when the confirmation is cancelled', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderMenu(onChange);

    await user.click(screen.getByText('Activo'));
    await user.click(await screen.findByText('Finalizado'));
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));

    await waitFor(() =>
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument(),
    );
    expect(onChange).not.toHaveBeenCalled();
  });
});
