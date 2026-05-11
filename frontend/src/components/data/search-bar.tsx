'use client';

/**
 * Search bar component for list pages.
 *
 * Debounces input to avoid excessive API calls.
 */

import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';

interface SearchBarProps {
  /** Placeholder text (Spanish — visible to user). */
  placeholder?: string;
  /** Current search value (controlled). */
  value: string;
  /** Called with the debounced search term. */
  onChange: (value: string) => void;
  /** Debounce delay in ms. Default: 300. */
  debounceMs?: number;
}

export function SearchBar({
  placeholder = 'Buscar...',
  value,
  onChange,
  debounceMs = 300,
}: SearchBarProps) {
  const [local, setLocal] = useState(value);

  useEffect(() => {
    setLocal(value);
  }, [value]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (local !== value) onChange(local);
    }, debounceMs);
    return () => clearTimeout(timer);
  }, [local, value, onChange, debounceMs]);

  return (
    <Input
      placeholder={placeholder}
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      className="max-w-sm"
    />
  );
}
