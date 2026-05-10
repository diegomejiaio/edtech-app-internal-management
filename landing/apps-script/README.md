# Clearbook Waitlist — Google Apps Script Backend

Backend para el formulario de waitlist de la landing. Recibe POST, valida (incluyendo RUC peruano módulo 11), guarda en Google Sheets, notifica al admin por email, y manda welcome email al lead.

**Costo:** $0 forever. **Volumen soportado:** ~20K requests/día (cuota Gmail gratis).

---

## Setup paso a paso (15 min)

### 1. Crear el Google Sheet (2 min)

1. Andá a [sheets.google.com](https://sheets.google.com) → **Crear hoja en blanco**.
2. Renombrala a **Clearbook — Waitlist Leads**.
3. NO crees columnas manualmente — el script las crea automático en el primer submit.
4. Copiá el **Sheet ID** de la URL: `https://docs.google.com/spreadsheets/d/{ESTE_ID}/edit`.

### 2. Pegar el Apps Script (3 min)

1. En el mismo Sheet → **Extensiones → Apps Script**.
2. Se abre el editor con `Code.gs` vacío. **Borrá todo el contenido**.
3. Copiá el contenido de [`Code.gs`](./Code.gs) de este folder y pegalo.
4. Editá `CONFIG` arriba del archivo:
   - `ADMIN_EMAIL`: a quién notificar cuando llega un lead nuevo (ej: `diego@clear-book.com`).
   - `ALLOWED_ORIGINS`: ya viene con los dominios correctos. Solo agregá si tenés un nuevo subdomain.
   - `SEND_WELCOME_EMAIL`: `true` para mandar welcome, `false` si todavía no.
5. **Ctrl+S** o ícono de disquete. Nombre del proyecto: `clearbook-waitlist`.

### 3. Probar el script localmente (2 min)

1. En el editor Apps Script, abrí el dropdown de funciones (arriba, al lado del botón ▶ Run).
2. Seleccioná `doGet`.
3. Click **Run**. La primera vez te pide permisos:
   - **Revisar permisos** → tu cuenta Google → **Avanzado** → **Ir a clearbook-waitlist (no seguro)** → **Permitir**.
   - Esto aparece porque el script usa Gmail + Sheets de tu cuenta. No publica nada.
4. Si todo OK, en **Ejecuciones** (menú izquierdo) ves el call con status `Completed`.

### 4. Deploy como Web App (3 min)

1. Arriba a la derecha: **Implementar → Nueva implementación**.
2. ⚙️ ícono engranaje → **Aplicación web**.
3. Configurá:
   - **Descripción**: `Waitlist v1`
   - **Ejecutar como**: **Yo** (`tu@gmail.com`)
   - **Quién tiene acceso**: **Cualquier usuario** ⚠️ obligatorio para que la landing pueda llamar
4. Click **Implementar**.
5. **Autorizá** otra vez si pide.
6. **Copiá la URL del Web App** — tiene formato: `https://script.google.com/macros/s/AKfycb.../exec`.

### 5. Conectar la landing (1 min)

La URL del Web App está **hardcoded** en `landing/src/components/WaitlistModal.astro` (constante `WAITLIST_URL` arriba del archivo).

Para conectar:
1. Abrí `landing/src/components/WaitlistModal.astro`.
2. Reemplazá el valor de `WAITLIST_URL` con tu URL `https://script.google.com/macros/s/.../exec`.
3. `pnpm dev` → llená el form → confirmá que aparece en el Sheet.

**¿Por qué hardcoded y no env var?** La URL es un endpoint POST público sin auth ni secretos (igual que un Typeform URL). Cualquier `PUBLIC_*` env var en Astro/Vite termina en el bundle del browser igual, así que la indirección no agrega seguridad — solo agrega complejidad de CI/CD. Si algún día necesitás backends distintos por entorno, revertí la constante a `import.meta.env.PUBLIC_WAITLIST_URL`.

### 6. Test end-to-end con curl (1 min)

```bash
curl -X POST 'https://script.google.com/macros/s/TU_ID/exec' \
  -H 'Content-Type: application/json' \
  -d '{
    "nombre": "Diego Test",
    "email": "diego@example.com",
    "ruc": "20612611620",
    "clientes": "21-50",
    "herramientas": ["Excel", "Concar"]
  }'
```

Esperás: `{"ok":true}`. Mirá el Sheet → debe haber una fila nueva.

### 7. Test de validación (debe fallar)

```bash
curl -X POST 'https://script.google.com/macros/s/TU_ID/exec' \
  -H 'Content-Type: application/json' \
  -d '{
    "nombre": "X",
    "email": "no-es-email",
    "ruc": "12345",
    "clientes": "muchos",
    "herramientas": []
  }'
```

Esperás:
```json
{"ok":false,"errors":["nombre_invalid","email_invalid","ruc_invalid","clientes_invalid","herramientas_invalid"]}
```

---

## Actualizar el script (después del primer deploy)

1. Editás `Code.gs` en este repo.
2. Lo copiás al editor Apps Script (Ctrl+A, paste).
3. **Implementar → Administrar implementaciones** → ícono lápiz ✏️ → **Versión: Nueva versión** → **Implementar**.
4. La URL **NO cambia**. La landing sigue funcionando sin tocar nada.

---

## Schema del Sheet (auto-generado)

| Columna | Tipo | Ejemplo |
|---------|------|---------|
| timestamp | ISO datetime | `2026-05-04T22:13:45.123Z` |
| nombre | string | `Diego Mejía` |
| email | string lowercase | `diego@example.com` |
| ruc | string 11 dígitos | `20612611620` |
| clientes | enum | `21-50` |
| herramientas | string CSV | `Excel, Concar` |
| userAgent | string | `Mozilla/5.0...` |
| referrer | string | `https://clear-book.com/` |
| ip | (vacío — Apps Script no expone) | |

---

## CORS

⚠️ **Importante:** Apps Script NO emite headers `Access-Control-Allow-Origin`. El navegador hace POST con `Content-Type: text/plain;charset=utf-8` o `application/x-www-form-urlencoded` para evitar el preflight CORS.

**El cliente JS debe usar:**
```ts
fetch(WAITLIST_URL, {
  method: "POST",
  body: JSON.stringify(payload), // sin headers Content-Type:application/json
});
```

Apps Script lee el body como texto, lo parsea como JSON internamente. Funciona en todos los navegadores modernos.

---

## Quotas a tener en cuenta

| Recurso | Free Gmail | Workspace |
|---------|------------|-----------|
| URL Fetch / día | 20,000 | 100,000 |
| Email recipients / día | 100 | 1,500 |
| Trigger executions / día | 90,000 | — |
| Tiempo por execution | 6 min | 6 min |

Para `<100 leads/mes` esto es **enormemente sobrado**. Si llegas a 100 leads/día (3K/mes), considerá migrar a Azure Function + Cosmos.

---

## Migrar a Azure Function (cuando crezca)

Cuando se justifique:

1. Exportar el Sheet a CSV.
2. Crear collection `waitlist_leads` en Cosmos vía Bicep.
3. Importar el CSV con un script one-off de `back/scheduler/`.
4. Crear `back/wk-waitlist/` con el mismo contrato (POST con los 5 campos).
5. Cambiar `WAITLIST_URL` en `landing/src/components/WaitlistModal.astro` a la nueva URL.
6. Borrar la Web App de Apps Script (o dejarla como backup).

Sin tocar el frontend.

---

## Troubleshooting

| Síntoma | Causa | Fix |
|---------|-------|-----|
| `{"ok":false,"errors":["ruc_invalid"]}` con RUC válido | Algoritmo módulo 11 mal copiado | Re-copiar `validateRucMod11_` de `Code.gs` |
| El form responde pero no hay fila en el Sheet | Permisos no autorizados | Re-deploy → autorizar todos los permisos pedidos |
| No llega email al admin | Cuota Gmail llena (100/día) | Esperá 24h o usar Workspace |
| CORS error en consola del browser | Cliente envía `Content-Type: application/json` (dispara preflight) | Quitar el header — ver sección CORS |
| Cambios al script no toman efecto | Olvidaste **Nueva versión** en deploy | Implementar → Administrar → Editar → Nueva versión |
