// Re-export period/UIT config types
export * from "./periods";

// Re-export declaration types
export * from "./declarations";

// Base types

export interface Empresa {
  id: string;
  clerkOrgId: string;
  ruc: string;
  razonSocial: string;
  nombreComercial?: string;
  direccion?: string;
  telefono?: string;
  email?: string;
  activo: boolean;
  createdAt: string;
}

export interface NotificacionSunat {
  id: string;
  clerkOrgId: string;
  empresaId: string;
  ruc: string;
  razonSocial?: string;
  messageId: string;
  fechaNotificacion: string;
  asunto: string;
  etiqueta?: string;
  pdf?: {
    blobUrl: string;
    blobName: string;
  };
  createdAt: string;
  leido: boolean;
}

export interface NotificacionesStats {
  total: number;
  ultimas24h: number;
  ultimos7dias: number;
  tipos: number;
  clientes: number;
}

export interface NotificacionesFilters {
  cliente?: string;
  asunto?: string;
  etiqueta?: string;
  fechaInicio?: string;
  fechaFin?: string;
}

// API types

// Auth
export interface UserContext {
  user_id: string;
  tenant_id: string;
  role: "master" | "admin" | "member";
  email: string;
  name?: string;
  assigned_companies?: string[];
}

// Tenants
export interface TenantUser {
  email: string;
  user_id: string | null; // null until user accepts invitation
  role: "admin" | "member";
  status: "pending" | "active";
  assigned_company_ids: string[]; // IDs of companies member can access (empty for admins)
  invited_at: string;
  activated_at: string | null; // null if pending
}

export interface Tenant {
  id: string; // _id from API (Clerk org_id)
  name: string;
  status: "pending" | "active" | "suspended";
  plan?: "basic" | "pro" | "enterprise";
  clerk_org_id?: string; // Clerk organization ID (may be same as id)
  logo_url?: string; // Public URL of the tenant logo in Azure Blob Storage
  contact?: {
    name: string;
    email: string;
    phone?: string;
  };
  users?: TenantUser[]; // Users belonging to this tenant
  activated_at?: string;
  activated_by?: string;
  created_at: string;
  updated_at: string;
}

export interface TenantUpdate {
  status?: "active" | "suspended";
  name?: string;
  plan?: "basic" | "pro" | "enterprise";
  contact?: {
    name: string;
    email: string;
    phone?: string;
  };
}

// Companies (API version of Empresa)
export interface Company {
  id: string;
  tenant_id: string;
  ruc: string;
  business_name: string;
  email?: string;
  is_active: boolean;
  has_credentials: boolean;
  has_api_credentials: boolean;
  credentials_valid?: boolean;
  created_at: string;
}

export interface CompanyCreate {
  ruc: string;
  business_name: string;
  email?: string;
}

export interface CompanyUpdate {
  business_name?: string;
  email?: string;
  is_active?: boolean;
  credentials?: {
    sol_user: string;
    sol_password: string;
  };
}

// Notifications (API version)
export interface Notification {
  id: string;
  company_id: string;
  ruc: string;
  razon_social?: string;
  message_id: string;
  fecha_notificacion: string;
  asunto: string;
  etiqueta?: string;
  pdf_url?: string;
  leido: boolean;
  created_at: string;
}

export interface NotificationUpdate {
  leido?: boolean;
}

// Jobs - Trigger
export type JobProcess =
  | "sunat_notifications"
  | "sire_compras_headers"
  | "sire_compras_details"
  | "sire_sales_headers"
  | "sire_ventas_details"
  | "detraction_validation";

export interface JobTrigger {
  process: JobProcess;
  tenant_id?: string; // required for Master, auto for Admin
  company_id?: string; // optional: single company
}

export interface JobResponse {
  job_id: string;
  companies_queued: number;
}

// Batches - Async Sync
export type BatchStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export interface SyncTriggerResponse {
  batch_id: string;
  total_jobs: number;
}

export interface ActiveBatchResponse {
  batch_id: string;
  process_type: JobProcess;
  status: BatchStatus;
  total_jobs: number;
  completed_jobs: number;
  successful_jobs: number;
  failed_jobs: number;
  cancelled_jobs: number;
  progress_percent: number;
}

export interface BatchJob {
  id: string;
  company_id: string;
  company_name?: string;
  ruc?: string;
  status: JobStatus;
  records_found: number;
  records_new: number;
  records_skipped: number;
  errors?: string[];
  started_at?: string;
  completed_at?: string;
  duration_ms?: number;
}

export interface Batch {
  id: string;
  tenant_id: string;
  tenant_name?: string;
  process_type: JobProcess;
  status: BatchStatus;
  total_jobs: number;
  completed_jobs: number;
  successful_jobs: number;
  failed_jobs: number;
  cancelled_jobs: number;
  progress: number;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  duration_ms?: number;
  triggered_by?: string;
}

export interface BatchDetail extends Batch {
  jobs: BatchJob[];
  metrics: {
    records_found: number;
    records_new: number;
    records_skipped: number;
    errors: number;
  };
}

export interface BatchListResponse {
  items: Batch[];
  next_cursor?: string;
  has_more: boolean;
}

// Jobs - Tracking
export type JobStatus = "pending" | "running" | "completed" | "failed";
export type StepStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "skipped";

export interface JobStep {
  name: string;
  status: StepStatus;
  started_at?: string;
  completed_at?: string;
  duration_ms?: number;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  error?: string;
}

export interface JobMetrics {
  total: number;
  new: number;
  skipped: number;
  errors: number;
  duration_ms: number;
}

export interface JobListItem {
  id: string;
  tenant_id: string;
  tenant_name?: string;
  company_id: string;
  company_name: string;
  ruc: string;
  process: JobProcess;
  status: JobStatus;
  started_at?: string;
  completed_at?: string;
  duration_ms?: number;
  metrics?: JobMetrics;
  error?: string;
  error_step?: string;
}

export interface JobDetail extends JobListItem {
  steps: JobStep[];
  retry_count: number;
  created_at: string;
}

export interface JobsListResponse {
  items: JobListItem[];
  next_cursor?: string;
  has_more: boolean;
}

export interface JobsFilters {
  tenant_id?: string;
  company_id?: string;
  ruc?: string;
  process?: JobProcess;
  status?: JobStatus;
  from_date?: string;
  to_date?: string;
}

// Users API (matches /api/v1/users endpoints)
export interface UserResponse {
  email: string;
  name: string | null;
  user_id: string | null;
  role: "admin" | "member";
  status: "pending" | "active";
  assigned_company_ids: string[];
  invited_at: string;
  activated_at: string | null;
}

export interface UserListResponse {
  items: UserResponse[];
  total_count: number;
}

export interface InviteUserRequest {
  email: string;
  role: "admin" | "member";
  name?: string;
}

export interface UpdateUserRequest {
  role?: "admin" | "member";
  assigned_company_ids?: string[];
}

// Legacy User type (deprecated - use UserResponse instead)
export interface User {
  id: string;
  clerk_user_id: string;
  tenant_id: string;
  email: string;
  name?: string;
  role: "admin" | "member";
  assigned_companies: string[];
  created_at: string;
}

export interface UserUpdate {
  assigned_companies?: string[];
  role?: "admin" | "member"; // only Master can change
}

// API Error
export interface ApiError {
  message: string;
  code?: string;
}

// Backend response format (actual)
export interface ListResponse<T> {
  items: T[];
  count: number;
}

// Cursor pagination (future)
export interface CursorPaginatedResponse<T> {
  items: T[];
  total_count?: number;
  credentials_count?: number;
  api_credentials_count?: number;
  next_cursor?: string;
  has_more: boolean;
}

// Legacy pagination (offset-based)
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

// Pagination params
export interface CursorPaginationParams {
  limit?: number;
  cursor?: string;
}

export interface OffsetPaginationParams {
  limit?: number;
  skip?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Vouchers (Comprobantes de Compra)
// ─────────────────────────────────────────────────────────────────────────────

export type VoucherValidationStatus = "valido" | "observado" | "rechazado";

export type VoucherDetailStatus =
  | "pending"
  | "completed"
  | "failed"
  | "not_found"
  | "not_available";

export interface TCValidation {
  official_rate: number;
  voucher_rate: number;
  deviation_pct: number;
  tolerance_pct: number;
  passed: boolean;
  lifted: boolean;
  lifted_by?: string | null;
  lifted_by_name?: string | null;
  lifted_reason?: string | null;
  lifted_at?: string | null;
}

export interface DetraccionItem {
  porDetraccion?: string | null; // String percentage e.g. "14.00"
  mtoDetraccion?: number | null;
  nroCuenta?: string | null;
  fechaVencimientoPago?: string | null; // DD/MM/YYYY
  codigoSustento?: string | null;
  numeroConstanciaDetraccion?: string | null; // Non-null = paid
}

export interface DetraccionValidation {
  detraccion_data: DetraccionItem;
  lifted: boolean;
  lifted_by?: string | null;
  lifted_by_name?: string | null;
  lifted_reason?: string | null;
  lifted_at?: string | null;
}

export interface AmountFieldMismatch {
  field: string; // e.g. "total", "igv_ipm_dg"
  header_value: number; // Value in the SIRE header (potentially wrong)
  detail_value: number; // Value from CPE detail (SUNAT ground truth)
  diff: number; // abs(header_value - detail_value)
}

export interface AmountValidation {
  checked: boolean; // false when validation was skipped (portal_fallback or unknown_series)
  passed: boolean;
  source?: string | null; // "procedenciaMasiva" | "procedenciaIndivual"
  skipped_reason?: string | null; // "portal_fallback" | "unknown_series"
  validated_at: string;
  mismatches: AmountFieldMismatch[];
  lifted: boolean;
  lifted_by?: string | null;
  lifted_by_name?: string | null;
  lifted_reason?: string | null;
  lifted_at?: string | null;
}

export interface DetractionPayment {
  validated: boolean;
  num_constancia: string | null;
  num_cuenta: string | null;
  fec_pago: string | null;
  mto_detraccion: number | null;
  validated_at: string;
  source: "auto" | "manual";
}

export interface Voucher {
  id: string;
  tenant_id: string;
  company_id: string;
  period: string;
  // Supplier info
  supplier_ruc: string;
  supplier_name: string;
  // Voucher identification
  sunat_car?: string; // CAR SUNAT identifier
  voucher_type: string;
  voucher_type_label: string;
  series: string;
  number: string;
  // Financial info
  currency: string;
  total: number;
  igv?: number;
  subtotal?: number;
  // SIRE header amounts (for breakdown display when detail_data is missing)
  taxable_base_dg?: number; // Base imponible gravada DG
  igv_ipm_dg?: number; // IGV/IPM DG
  taxable_base_dgng?: number; // Base imponible gravada DGNG
  igv_ipm_dgng?: number; // IGV/IPM DGNG
  taxable_base_dng?: number; // Base imponible gravada DNG
  igv_ipm_dng?: number; // IGV/IPM DNG
  non_taxed_acq_value?: number; // Valor adquisiciones no gravadas (Inafecto)
  isc?: number; // ISC
  icbper?: number; // ICBPER
  other_taxes_charges?: number; // Otros tributos/cargos
  detraction?: string; // Detracción (SUNAT)
  // Modified document reference (for credit/debit notes: voucher_type 07/08)
  modified_doc?: {
    issue_date?: string;
    voucher_type?: string;
    series?: string;
    number?: string;
  };
  // Dates (API returns as emission_date, DB stores as issue_date)
  emission_date?: string; // format: DD/MM/YYYY from SIRE
  due_date?: string; // format: DD/MM/YYYY from SIRE
  // Exchange rate (when currency !== PEN)
  exchange_rate?: number; // SUNAT exchange rate used to convert to PEN
  // Detail status
  detail_status: VoucherDetailStatus;
  // Accountant validation status (default: "valido")
  validation_status: VoucherValidationStatus;
  // TC (tipo de cambio) validation — only populated for USD vouchers
  tc_validation?: TCValidation | null;
  // Detracción validation — only populated for compras with unpaid detracción
  detraccion_validation?: DetraccionValidation | null;
  // Amount validation — consistency check between SIRE header and CPE detail amounts
  amount_validation?: AmountValidation | null;
  // Detraction payment — confirmed payment from SUNAT API (wk-detraction-validation)
  detraction_payment?: DetractionPayment | null;
  detail_completed_at?: string;
  has_detail: boolean;
  description_summary?: string; // Summary of item descriptions
  // Full detail data (only in GET /vouchers/{id})
  detail_data?: VoucherDetailData;
  // Metadata
  created_at: string;
  updated_at?: string;
}

// CPE detail data structure from SUNAT
export interface VoucherDetailData {
  comprobantes?: Array<{
    informacionItems?: VoucherItem[];
    procedenciaMasiva?: VoucherTotals;
    fecEmision?: string;
    fecRegistro?: string;
    desObservacion?: string;
    informacionDetraccion?: Array<{
      desLeyenda?: string;
      desBienServicio?: string;
      porDetraccion?: string;
      mtoDetraccion?: number;
    }>;
  }>;
}

export interface VoucherTotals {
  // Base amounts by tax type
  mtoTotalValVentaGrabado?: number; // Base gravada (taxable)
  mtoTotalValVentaInafecto?: number; // Inafecto (non-taxable)
  mtoTotalValVentaExonerado?: number; // Exonerado (exempt)
  // Taxes
  mtoSumIGV?: number; // IGV (18%)
  mtoSumISC?: number; // ISC (Impuesto Selectivo al Consumo)
  mtoSumOtrosTributos?: number; // Other taxes/tributes
  // Discounts and charges
  mtoTotalDtos?: number; // Total discounts
  mtoSumOtrosCargos?: number; // Other charges
  // Total
  mtoImporteTotal?: number; // Final total
}

export interface VoucherItem {
  desItem?: string;
  cntItems?: number;
  codUnidadMedida?: string;
  desUnidadMedida?: string;
  mtoValUnitario?: number;
  mtoImpTotal?: number;
  mtoDesc?: number;
  mtoICBPER?: number;
}

export interface VouchersStats {
  total: number;
  by_status: {
    pending: number;
    completed: number;
    failed: number;
    not_found: number;
    not_available: number;
  };
  by_type: Record<
    string,
    {
      code: string;
      label: string;
      count: number;
    }
  >;
  total_amount: number;
  total_igv: number;
  // Separated by currency
  total_pen: number;
  igv_pen: number;
  total_usd: number;
  igv_usd: number;
  // SIRE RVCE IGV breakdown: sum of igv_ipm_dg + igv_ipm_dgng + igv_ipm_dng
  igv_compras: number;
}

export interface VouchersFilters {
  company_id?: string;
  period?: string;
  voucher_type?: string;
  detail_status?: VoucherDetailStatus;
  validation_status?: VoucherValidationStatus;
  supplier_ruc?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Email Communications
// ─────────────────────────────────────────────────────────────────────────────

export type EmailNotificationStatus =
  | "queued"
  | "sending"
  | "sent"
  | "delivered"
  | "failed";
export type EmailTemplateCategory =
  | "documentos"
  | "declaraciones"
  | "cobranza"
  | "general";

// Email Template
export type EmailVariableType = "text" | "date" | "number" | "currency";

export interface EmailTemplateVariable {
  key: string;
  description: string;
  required: boolean;
  is_system: boolean; // true = auto-filled from DB, false = user must provide
  type?: EmailVariableType; // Variable type (defaults to 'text')
  default_hint?: string; // hint for default value calculation (e.g., "mes_anterior")
  default_value?: string; // static default value
}

export interface EmailTemplate {
  id: string;
  tenant_id: string | null; // null for system templates
  template_key: string;
  name: string;
  description: string;
  category: EmailTemplateCategory;
  template_type: "simple" | "custom_html"; // simple = auto-generate HTML, custom_html = use body_html directly
  subject: string;
  body_text: string; // Plain text content with {{variables}}
  body_html?: string; // Rendered HTML (read-only for simple, editable for custom_html)
  header_color: string; // Hex color for email header (e.g., '#2563eb')
  variables: EmailTemplateVariable[];
  is_system: boolean;
  is_customized: boolean;
  base_template_id?: string | null; // ID of system template if customized from it
  created_at: string;
  updated_at: string;
}

export interface EmailTemplateUpdate {
  name?: string;
  description?: string;
  category?: EmailTemplateCategory;
  subject?: string;
  body_text?: string;
  header_color?: string; // Hex color for email header
  variables?: EmailTemplateVariable[]; // Only custom variables (is_system=false)
}

export interface EmailTemplateCreate {
  name: string;
  description?: string;
  category?: EmailTemplateCategory;
  subject: string;
  body_text: string;
  header_color?: string; // Hex color for email header
  variables?: EmailTemplateVariable[]; // Only custom variables
}

export interface EmailTemplatePreviewRequest {
  variables: Record<string, string>;
  additional_message?: string;
  // Live preview fields - override saved values with unsaved edits
  subject?: string;
  body_text?: string;
  header_color?: string;
}

export interface EmailTemplatePreviewResponse {
  subject: string;
  body_html: string;
  body_text: string;
  missing_variables: string[];
}

// Email Notification (sent email record)
export interface EmailNotification {
  id: string;
  tenant_id: string;
  // Sender
  sender_address: string;
  sender_display_name: string;
  // Recipient
  company_id: string;
  company_ruc: string;
  company_name: string;
  contact_id: string;
  contact_name: string;
  contact_email: string;
  // Content
  template_id: string;
  template_name: string;
  subject: string;
  body_html?: string;
  // Status
  status: EmailNotificationStatus;
  error?: {
    code: string;
    message: string;
  };
  // Timestamps
  created_at: string;
  sent_at?: string;
  delivered_at?: string;
}

export interface EmailNotificationsFilters {
  company_id?: string;
  status?: EmailNotificationStatus;
  start_date?: string;
  end_date?: string;
}

// Send email request
export interface EmailRecipient {
  company_id: string;
  contact_ids?: string[] | null; // null = use company's default contacts
}

export interface SendEmailRequest {
  template_id: string;
  recipients: EmailRecipient[];
  variables: Record<string, string>;
  subject_override?: string;
  body_override?: string;
  additional_message?: string;
}

export interface SendEmailResponse {
  items: Array<{
    notification_id: string;
    contact_email: string;
    status: EmailNotificationStatus;
  }>;
  total_queued: number;
}

// Company Contact (embedded in Company)
export interface CompanyContact {
  id: string;
  name: string;
  email: string;
  role?: string;
  is_primary: boolean;
  receives_notifications: boolean; // Flag for email notifications
  created_at: string;
  updated_at?: string;
}

export interface CompanyContactCreate {
  name: string;
  email: string;
  role?: string;
  is_primary?: boolean;
  receives_notifications?: boolean;
}

export interface CompanyContactUpdate {
  name?: string;
  email?: string;
  role?: string;
  is_primary?: boolean;
  receives_notifications?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Sales Vouchers (Comprobantes de Venta - SIRE RVIE)
// ─────────────────────────────────────────────────────────────────────────────

export type SalesVoucherValidationStatus =
  | "activo"
  | "baja"
  | "revertido"
  | "anulado";

export type SalesVoucherDetailStatus =
  | "pending"
  | "completed"
  | "failed"
  | "not_found"
  | "not_available";

export interface SalesVoucherItem {
  desItem?: string;
  cntItems?: number;
  desUnidadMedida?: string;
  mtoValUnitario?: number;
  mtoImpTotal?: number;
  [key: string]: unknown;
}

export interface SalesVoucherDetailData {
  comprobantes?: Array<{
    informacionItems?: SalesVoucherItem[];
    [key: string]: unknown;
  }>;
  [key: string]: unknown;
}

export interface SalesVoucher {
  id: string;
  tenant_id: string;
  company_id: string;
  ruc: string;
  period: string;
  // Document identification
  doc_type: string;
  doc_type_label: string;
  series: string;
  doc_number: string;
  // Dates
  issue_date: string; // format: DD/MM/YYYY
  // Customer info
  customer_name?: string;
  id_doc_type?: string;
  id_doc_number?: string;
  // Financial info
  currency: string;
  taxable_base?: number; // BI Gravada DG
  igv_ipm?: number; // IGV / IPM DG
  exempt_amount?: number; // Monto Exonerado
  unaffected_amount?: number; // Monto Inafecto
  total_amount?: number;
  // Validation status
  validation_status: SalesVoucherValidationStatus;
  // Detail extraction status (populated by wk-sales-details)
  detail_status?: SalesVoucherDetailStatus;
  // Detail data from CPE API (populated by wk-sales-details)
  detail_data?: SalesVoucherDetailData;
  // Metadata
  created_at: string;
  updated_at?: string;
}

export interface SalesVouchersStats {
  total: number;
  by_validation_status: {
    activo: number;
    baja: number;
    revertido: number;
    anulado: number;
  };
  by_doc_type: Record<
    string,
    {
      code: string;
      label: string;
      count: number;
    }
  >;
  // SIRE RVIE IGV: sum of igv_ipm across all sales vouchers
  igv_total: number;
}

export interface SalesVouchersStatsByCompanyItem {
  company_id: string;
  ruc: string;
  business_name: string;
  total: number;
  activo: number;
  baja: number;
  revertido: number;
  anulado: number;
  total_pen: number;
  total_usd: number;
}

export interface SalesVouchersStatsByCompanyResponse {
  period: string;
  items: SalesVouchersStatsByCompanyItem[];
}

export interface SalesVouchersFilters {
  company_id?: string;
  period?: string;
  doc_type?: string;
  validation_status?: SalesVoucherValidationStatus;
  customer_ruc?: string;
}
