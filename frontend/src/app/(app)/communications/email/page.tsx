'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Mail, History, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { FadeIn } from '@/components/motion'
import { EmailHistoryTab, EmailTemplatesTab } from '@/components/communications'

type TabValue = 'history' | 'templates'

export default function EmailPage() {
  const searchParams = useSearchParams()
  const initialTab = (searchParams.get('tab') as TabValue) || 'history'
  const [activeTab, setActiveTab] = useState<TabValue>(initialTab)

  return (
    <div className="space-y-6">
      {/* Header */}
      <FadeIn>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Comunicaciones por Email</h1>
            <p className="text-muted-foreground">
              Gestiona el historial de correos enviados y personaliza las plantillas
            </p>
          </div>
          <Button asChild size="sm">
            <Link href="/communications/email/compose">
              <Mail className="mr-2 h-4 w-4" />
              Nuevo correo
            </Link>
          </Button>
        </div>
      </FadeIn>

      {/* Tabs */}
      <FadeIn delay={0.1}>
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabValue)}>
          <TabsList>
            <TabsTrigger value="history">
              <History className="mr-2 h-4 w-4" />
              Historial
            </TabsTrigger>
            <TabsTrigger value="templates">
              <FileText className="mr-2 h-4 w-4" />
              Plantillas
            </TabsTrigger>
          </TabsList>

          <TabsContent value="history" className="mt-6">
            <EmailHistoryTab />
          </TabsContent>

          <TabsContent value="templates" className="mt-6">
            <EmailTemplatesTab />
          </TabsContent>
        </Tabs>
      </FadeIn>
    </div>
  )
}
