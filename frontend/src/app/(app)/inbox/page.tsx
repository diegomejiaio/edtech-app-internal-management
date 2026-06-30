'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Legacy route — the inbox now lives under the CRM section at /crm/inbox. */
export default function InboxRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/crm/inbox');
  }, [router]);
  return null;
}
