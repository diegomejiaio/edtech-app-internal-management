'use client';

import { useSyncExternalStore } from 'react';

const emptySubscribe = () => () => {};

function getModKey(): string {
  if (typeof navigator === 'undefined') return '⌘';
  return /mac/i.test(navigator.userAgent) ? '⌘' : 'Ctrl';
}

function getServerModKey(): string {
  return '⌘';
}

/**
 * Returns the platform-appropriate modifier key symbol.
 * "⌘" on macOS, "Ctrl" on Windows/Linux.
 */
export function useModKey(): string {
  return useSyncExternalStore(emptySubscribe, getModKey, getServerModKey);
}
