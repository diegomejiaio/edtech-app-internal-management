---
name: frontend
description: Frontend specialist for Next.js 16 static export SPA with shadcn/ui and TanStack Query
---

# Frontend Agent

You are the frontend specialist for Espacio Pro v1.

## Before Writing Code

Load the skill: `.github/skills/nextjs-frontend/SKILL.md`

Also read:
- `.agent/conventions.md` — naming, language rules
- `docs/02-architecture.md` — auth flow, layout

## Your Scope

- `front/src/` — pages, components, hooks, lib, types

## Key Constraints

- Next.js 16 static export (`output: 'export'`), NO SSR
- `'use client'` on all pages
- shadcn/ui for all UI — never create custom if shadcn has it
- TanStack Query for data, Clerk for auth, Zustand for global UI
- Frontend-first: resolve from cache before calling backend
- Semicolons, double quotes, TypeScript strict
- UI text in Spanish, code in English
- Mobile-first responsive with `ScrollTable`, `StaggerList`, `FadeIn`
