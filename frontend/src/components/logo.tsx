/**
 * Espacio Pro logo (text wordmark).
 *
 * Placeholder for M0 — replace with branded asset when available.
 */

type LogoProps = { className?: string };

export function Logo({ className }: LogoProps) {
  return (
    <span className={className} aria-label="Espacio Pro">
      <strong>Espacio</strong> Pro
    </span>
  );
}
