'use client';

import { useEffect } from 'react';

const APP_NAME = 'Espacio Pro';

const EXACT_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/catalogs': 'Catálogos',
  '/courses': 'Cursos',
  '/levels': 'Niveles',
  '/weekdays': 'Días',
  '/student-sources': 'Fuentes de alumnos',
  '/spaces': 'Espacios',
  '/payment-methods': 'Medios de pago',
  '/expense-categories': 'Categorías de gastos',
  '/teachers': 'Profesores',
  '/students': 'Alumnos',
  '/schedules': 'Horarios',
  '/enrollments': 'Inscripciones',
  '/student-payments': 'Pagos de alumnos',
  '/teacher-payments': 'Pagos de profesores',
  '/expenses': 'Gastos',
  '/collections': 'Cobranzas',
  '/inbox': 'Bandeja',
  '/crm': 'CRM',
  '/crm/inbox': 'CRM · Inbox',
  '/crm/explorer': 'CRM · Explorador',
  '/crm/library': 'CRM · Librería',
  '/crm/metrics': 'CRM · Métricas',
  '/crm/flows': 'CRM · Flujos',
  '/crm/agents': 'CRM · Agentes',
  '/crm/settings': 'CRM · Configuración',
};

const PREFIX_TITLES: Array<[string, string]> = [
  ['/students/detail', 'Detalle de alumno'],
  ['/teachers/detail', 'Detalle de profesor'],
  ['/schedules/detail', 'Detalle de horario'],
];

export function getRouteTitle(pathname: string): string {
  if (EXACT_TITLES[pathname]) return EXACT_TITLES[pathname];

  for (const [prefix, title] of PREFIX_TITLES) {
    if (pathname.startsWith(prefix)) return title;
  }

  return '';
}

export function useDocumentTitle(sectionTitle: string) {
  useEffect(() => {
    const title = sectionTitle ? `${sectionTitle} · ${APP_NAME}` : APP_NAME;
    if (document.title !== title) {
      document.title = title;
    }
  }, [sectionTitle]);
}
