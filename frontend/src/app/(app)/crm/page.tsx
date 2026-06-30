'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** `/crm` has no content of its own — send users to the inbox sub-tab. */
export default function CrmIndexPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/crm/inbox');
  }, [router]);
  return null;
}
