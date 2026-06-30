'use client';

/**
 * CRM section shell. Fills the available height and neutralizes the app `main`
 * padding (`-m-6`) so the inbox (and future panes) span edge to edge and manage
 * their own internal scroll. Section navigation lives in the left sidebar ("CRM" group).
 */

export default function CrmLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      {children}
    </div>
  );
}
