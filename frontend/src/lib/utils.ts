import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Fixes text that was incorrectly encoded as Latin-1 but contains UTF-8 bytes.
 * Example: "ResoluciÃ³n" → "Resolución"
 * 
 * TODO: Remove this once backend fixes the encoding at source
 */
export function fixEncoding(text: string): string {
  try {
    // Convert string to bytes assuming Latin-1, then decode as UTF-8
    const bytes = new Uint8Array([...text].map(c => c.charCodeAt(0)))
    return new TextDecoder('utf-8').decode(bytes)
  } catch {
    // If decoding fails, return original text
    return text
  }
}