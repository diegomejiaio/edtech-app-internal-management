/**
 * Clearbook Waitlist — Google Apps Script Backend
 *
 * Recibe POST del formulario waitlist (landing/src/components/WaitlistModal.astro),
 * valida los 5 campos, deduplica por email, guarda en Google Sheet,
 * y envía 2 emails: notificación al admin + welcome al lead.
 *
 * Ver landing/apps-script/README.md para setup paso a paso.
 *
 * Contrato del request body:
 *   {
 *     "nombre": "Diego Mejía",
 *     "email": "diego@example.com",
 *     "ruc": "20612611620",
 *     "clientes": "21-50",
 *     "herramientas": ["Excel", "Concar"],
 *     "userAgent": "Mozilla/5.0 ...",
 *     "referrer": "https://clear-book.com/"
 *   }
 *
 * Responses:
 *   200 OK     → { "ok": true }
 *   200 OK     → { "ok": true, "duplicate": true }   (mismo email ya registrado)
 *   200 OK     → { "ok": false, "errors": ["nombre_invalid", ...] }
 *   200 OK     → { "ok": false, "errors": ["server_error"] }
 *
 * Apps Script SIEMPRE responde 200 (por limitación de ContentService).
 * El cliente debe usar el flag `ok` para distinguir éxito vs error.
 */

// ─────────────────────────────────────────────────────────────
// CONFIGURACIÓN — editar antes del primer deploy
// ─────────────────────────────────────────────────────────────

const CONFIG = {
  // Email donde llegan las notificaciones de leads nuevos
  ADMIN_EMAIL: "clearbookboard@gmail.com",

  // Nombre que aparece como remitente en los emails
  SENDER_NAME: "Clearbook",

  // Mandar welcome email al lead. Cambiar a false si todavía no quieres.
  SEND_WELCOME_EMAIL: true,

  // URL pública de la landing (para links en emails)
  LANDING_URL: "https://clear-book.com",

  // Nombre de la pestaña dentro del Sheet (se crea automático si no existe)
  SHEET_NAME: "Leads",

  // Orígenes permitidos (referencial — Apps Script no honra CORS,
  // pero validamos a nivel de aplicación para rechazar requests externos)
  ALLOWED_ORIGINS: [
    "https://clear-book.com",
    "https://www.clear-book.com",
    "https://dev.clear-book.com",
    "http://localhost:4321",
  ],
};

// Headers del Sheet (orden importa — refleja columnas)
const SHEET_HEADERS = [
  "timestamp",
  "nombre",
  "email",
  "ruc",
  "clientes",
  "herramientas",
  "userAgent",
  "referrer",
  "status",
];

// Valores válidos para el campo `clientes`
const CLIENTES_VALID = ["1-5", "6-20", "21-50", "51-100", "100+"];

// ─────────────────────────────────────────────────────────────
// HTTP Handlers
// ─────────────────────────────────────────────────────────────

/**
 * GET handler — health check.
 * Llamar en el navegador a la URL del Web App debería devolver { ok: true }.
 */
function doGet(e) {
  return jsonResponse({
    ok: true,
    service: "clearbook-waitlist",
    version: "1.0.0",
    time: new Date().toISOString(),
  });
}

/**
 * POST handler — recibe el lead, valida, guarda, notifica.
 *
 * NOTA: el cliente NO envía Content-Type:application/json (para evitar CORS
 * preflight). El body llega como texto plano que parseamos manualmente.
 */
function doPost(e) {
  try {
    const payload = parsePayload_(e);
    if (!payload) {
      return jsonResponse({ ok: false, errors: ["invalid_body"] });
    }

    // Validar todos los campos
    const errors = validatePayload_(payload);
    if (errors.length > 0) {
      return jsonResponse({ ok: false, errors: errors });
    }

    // Normalizar
    const lead = normalizeLead_(payload);

    // Dedup por email
    if (emailAlreadyExists_(lead.email)) {
      logInfo_("Duplicate lead", { email: lead.email });
      return jsonResponse({ ok: true, duplicate: true });
    }

    // Guardar en Sheet
    appendLead_(lead);

    // Emails (no fail si fallan — el lead ya está guardado)
    try {
      sendAdminNotification_(lead);
    } catch (emailErr) {
      logError_("Admin email failed", emailErr);
    }

    if (CONFIG.SEND_WELCOME_EMAIL) {
      try {
        sendWelcomeEmail_(lead);
      } catch (emailErr) {
        logError_("Welcome email failed", emailErr);
      }
    }

    return jsonResponse({ ok: true });
  } catch (err) {
    logError_("Unhandled error in doPost", err);
    return jsonResponse({ ok: false, errors: ["server_error"] });
  }
}

// ─────────────────────────────────────────────────────────────
// Validación
// ─────────────────────────────────────────────────────────────

/**
 * Parse del body del POST. Acepta JSON tanto si viene con Content-Type
 * application/json como si viene como text/plain (workaround CORS).
 */
function parsePayload_(e) {
  if (!e || !e.postData || !e.postData.contents) return null;
  try {
    return JSON.parse(e.postData.contents);
  } catch (err) {
    return null;
  }
}

/**
 * Valida los 5 campos del formulario. Retorna array de error codes
 * (vacío si todo OK).
 */
function validatePayload_(p) {
  const errors = [];

  // nombre: string, min 2 chars
  if (typeof p.nombre !== "string" || p.nombre.trim().length < 2) {
    errors.push("nombre_invalid");
  }

  // email: regex básica
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (typeof p.email !== "string" || !emailRe.test(p.email.trim())) {
    errors.push("email_invalid");
  }

  // ruc: 11 dígitos + módulo 11 SUNAT
  if (typeof p.ruc !== "string" || !validateRucMod11_(p.ruc.trim())) {
    errors.push("ruc_invalid");
  }

  // clientes: enum
  if (typeof p.clientes !== "string" || CLIENTES_VALID.indexOf(p.clientes) === -1) {
    errors.push("clientes_invalid");
  }

  // herramientas: array no vacío de strings
  if (!Array.isArray(p.herramientas) || p.herramientas.length === 0) {
    errors.push("herramientas_invalid");
  } else {
    const allStrings = p.herramientas.every(function (h) {
      return typeof h === "string" && h.trim().length > 0;
    });
    if (!allStrings) errors.push("herramientas_invalid");
  }

  return errors;
}

/**
 * Valida RUC peruano:
 *   - 11 dígitos numéricos
 *   - Prefijo 10, 15, 16, 17 o 20
 *   - Dígito verificador correcto (módulo 11 SUNAT)
 */
function validateRucMod11_(ruc) {
  if (!/^\d{11}$/.test(ruc)) return false;

  const prefix = ruc.substring(0, 2);
  if (["10", "15", "16", "17", "20"].indexOf(prefix) === -1) return false;

  const weights = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(ruc.charAt(i), 10) * weights[i];
  }
  const remainder = sum % 11;
  let expected = 11 - remainder;
  if (expected === 10) expected = 0;
  if (expected === 11) expected = 1;

  return expected === parseInt(ruc.charAt(10), 10);
}

// ─────────────────────────────────────────────────────────────
// Sheet (storage)
// ─────────────────────────────────────────────────────────────

/**
 * Normaliza un payload validado a un lead "limpio" para guardar.
 */
function normalizeLead_(p) {
  return {
    timestamp: new Date().toISOString(),
    nombre: p.nombre.trim(),
    email: p.email.trim().toLowerCase(),
    ruc: p.ruc.trim(),
    clientes: p.clientes,
    herramientas: p.herramientas.map(function (h) { return h.trim(); }).join(", "),
    userAgent: (p.userAgent || "").substring(0, 500),
    referrer: (p.referrer || "").substring(0, 500),
    status: "new",
  };
}

/**
 * Devuelve la pestaña del Sheet (la crea si no existe) con headers iniciales.
 */
function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(CONFIG.SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SHEET_NAME);
    sheet.appendRow(SHEET_HEADERS);
    // Estilo header: bold + freeze
    const headerRange = sheet.getRange(1, 1, 1, SHEET_HEADERS.length);
    headerRange.setFontWeight("bold");
    headerRange.setBackground("#f3f4f6");
    sheet.setFrozenRows(1);
  }

  return sheet;
}

/**
 * Append de un lead al Sheet.
 */
function appendLead_(lead) {
  const sheet = getSheet_();
  const row = SHEET_HEADERS.map(function (key) {
    return lead[key] !== undefined ? lead[key] : "";
  });
  sheet.appendRow(row);
}

/**
 * Dedup por email (case-insensitive). Lee toda la columna `email`.
 * Para <10K leads esto es instantáneo (<200ms).
 */
function emailAlreadyExists_(email) {
  const sheet = getSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return false; // Solo headers o vacío

  const emailColIndex = SHEET_HEADERS.indexOf("email") + 1;
  const range = sheet.getRange(2, emailColIndex, lastRow - 1, 1);
  const values = range.getValues();
  const target = email.toLowerCase();

  for (let i = 0; i < values.length; i++) {
    const cell = values[i][0];
    if (typeof cell === "string" && cell.toLowerCase() === target) {
      return true;
    }
  }
  return false;
}

// ─────────────────────────────────────────────────────────────
// Emails
// ─────────────────────────────────────────────────────────────

/**
 * Notifica al admin que llegó un lead nuevo.
 */
function sendAdminNotification_(lead) {
  const subject = "🎉 Nuevo lead waitlist: " + lead.nombre + " (" + lead.email + ")";

  const html =
    '<div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 560px;">' +
      '<h2 style="color: #1f2937; margin-bottom: 8px;">Nuevo lead en la waitlist</h2>' +
      '<p style="color: #6b7280; margin-top: 0;">' + lead.timestamp + "</p>" +
      '<table style="border-collapse: collapse; width: 100%; margin-top: 16px;">' +
        emailRow_("Nombre", lead.nombre) +
        emailRow_("Email", '<a href="mailto:' + lead.email + '">' + lead.email + "</a>") +
        emailRow_("RUC", lead.ruc) +
        emailRow_("Clientes", lead.clientes) +
        emailRow_("Herramientas", lead.herramientas) +
        emailRow_("Referrer", lead.referrer || "—") +
        emailRow_("User Agent", lead.userAgent || "—") +
      "</table>" +
      '<p style="margin-top: 24px; color: #6b7280; font-size: 13px;">' +
        "Lead guardado en el Sheet. Total leads: ver pestaña " + CONFIG.SHEET_NAME + "." +
      "</p>" +
    "</div>";

  MailApp.sendEmail({
    to: CONFIG.ADMIN_EMAIL,
    subject: subject,
    htmlBody: html,
    name: CONFIG.SENDER_NAME,
  });
}

function emailRow_(label, value) {
  return (
    '<tr>' +
      '<td style="padding: 6px 12px; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-size: 13px;">' + label + "</td>" +
      '<td style="padding: 6px 12px; border-bottom: 1px solid #e5e7eb; color: #1f2937; font-size: 14px;">' + value + "</td>" +
    "</tr>"
  );
}

/**
 * Welcome email al lead.
 */
function sendWelcomeEmail_(lead) {
  const firstName = lead.nombre.split(" ")[0];
  const subject = "¡Estás en la waitlist de Clearbook, " + firstName + "!";

  const html =
    '<div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 560px; color: #1f2937;">' +
      '<h2 style="color: #1f2937; margin-bottom: 16px;">¡Hola ' + firstName + "! 👋</h2>" +
      '<p style="font-size: 15px; line-height: 1.6;">' +
        "Gracias por registrarte en la waitlist de <strong>Clearbook</strong>. " +
        "Recibimos tu solicitud y te contactaremos apenas abramos acceso para tu estudio." +
      "</p>" +
      '<p style="font-size: 15px; line-height: 1.6;">' +
        "Mientras tanto, si quieres contarnos más sobre tu operación o tienes alguna pregunta, " +
        'simplemente responde este correo — lo leemos personalmente.' +
      "</p>" +
      '<div style="margin: 32px 0; padding: 20px; background: #f9fafb; border-radius: 8px; border-left: 3px solid #3b82f6;">' +
        '<p style="margin: 0 0 8px 0; font-size: 13px; color: #6b7280;">Estos son los datos que registraste:</p>' +
        '<p style="margin: 0; font-size: 14px; line-height: 1.6;">' +
          "<strong>RUC:</strong> " + lead.ruc + "<br>" +
          "<strong>Clientes:</strong> " + lead.clientes + "<br>" +
          "<strong>Herramientas actuales:</strong> " + lead.herramientas +
        "</p>" +
      "</div>" +
      '<p style="font-size: 15px; line-height: 1.6;">' +
        "Si quieres saber más sobre lo que estamos construyendo, visita " +
        '<a href="' + CONFIG.LANDING_URL + '" style="color: #3b82f6;">' + CONFIG.LANDING_URL + "</a>." +
      "</p>" +
      '<p style="font-size: 15px; line-height: 1.6; margin-top: 24px;">' +
        "Un abrazo,<br>" +
        "<strong>El equipo de Clearbook</strong>" +
      "</p>" +
    "</div>";

  MailApp.sendEmail({
    to: lead.email,
    subject: subject,
    htmlBody: html,
    name: CONFIG.SENDER_NAME,
    replyTo: CONFIG.ADMIN_EMAIL,
  });
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

/**
 * Devuelve un response JSON con el formato correcto para Apps Script.
 */
function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function logInfo_(msg, ctx) {
  console.log(msg, ctx ? JSON.stringify(ctx) : "");
}

function logError_(msg, err) {
  console.error(msg, err && err.stack ? err.stack : String(err));
}

// ─────────────────────────────────────────────────────────────
// Test helpers (correr manualmente desde el editor Apps Script)
// ─────────────────────────────────────────────────────────────

/**
 * Test manual: simula un POST con datos válidos.
 * Usar desde el editor Apps Script: dropdown de funciones → testValidPost → Run.
 */
function testValidPost() {
  const fakeEvent = {
    postData: {
      contents: JSON.stringify({
        nombre: "Diego Test",
        email: "diego.test+" + Date.now() + "@example.com",
        ruc: "20612611620",
        clientes: "21-50",
        herramientas: ["Excel", "Concar"],
        userAgent: "Test User Agent",
        referrer: "https://clear-book.com/test",
      }),
    },
  };
  const result = doPost(fakeEvent);
  console.log("Result:", result.getContent());
}

/**
 * Test manual: simula un POST con datos inválidos.
 * Debería retornar errores de validación.
 */
function testInvalidPost() {
  const fakeEvent = {
    postData: {
      contents: JSON.stringify({
        nombre: "X",
        email: "no-es-email",
        ruc: "12345",
        clientes: "muchos",
        herramientas: [],
      }),
    },
  };
  const result = doPost(fakeEvent);
  console.log("Result:", result.getContent());
}
