'use client';

import { useEffect } from 'react';

interface UseKeyboardShortcutOptions {
  enabled?: boolean;
}

/**
 * Registers a global keyboard shortcut (⌘/Ctrl + key).
 * Only fires when no input/textarea/contenteditable is focused.
 */
export function useKeyboardShortcut(
  key: string,
  callback: () => void,
  options: UseKeyboardShortcutOptions = {},
) {
  const { enabled = true } = options;

  useEffect(() => {
    if (!enabled || !key) return;

    function handler(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      const isInput =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable;

      if (isInput) return;

      const isMod = e.metaKey || e.ctrlKey;
      if (isMod && e.key.toLowerCase() === key.toLowerCase()) {
        e.preventDefault();
        callback();
      }
    }

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [key, callback, enabled]);
}
