using System.Text.Json;
using Azure.AI.Agents.Persistent;

namespace EspacioPro.TelegramAgent.Agent.Foundry;

/// <summary>
/// Declarative catalog of the function tools the Foundry agent can call. Each tool
/// maps 1:1 to an <see cref="Api.EspacioProApiClient"/> operation; the agent never
/// touches Cosmos directly. Tool execution lives in <see cref="AgentToolDispatcher"/>.
/// </summary>
public static class AgentToolset
{
    public const string GetCatalog = "get_catalog";
    public const string QuerySchedules = "query_schedules";
    public const string QuerySessions = "query_sessions";
    public const string ListTeachers = "list_teachers";
    public const string ListStudents = "list_students";
    public const string FindEnrollments = "find_enrollments";
    public const string QuerySchedulePayments = "query_schedule_payments";
    public const string CreateSchedule = "create_schedule";
    public const string CreateStudent = "create_student";
    public const string CreateEnrollment = "create_enrollment";
    public const string RegisterStudentPayment = "register_student_payment";
    public const string GetTeacher = "get_teacher";
    public const string CreateTeacher = "create_teacher";
    public const string UpdateTeacher = "update_teacher";
    public const string UpdateStudent = "update_student";
    public const string UpdateSchedule = "update_schedule";
    public const string UpdateEnrollment = "update_enrollment";
    public const string QueryScheduleDashboard = "query_schedule_dashboard";
    public const string ListStudentPayments = "list_student_payments";
    public const string UpdateStudentPayment = "update_student_payment";
    public const string CreateTeacherPayment = "create_teacher_payment";
    public const string ListTeacherPayments = "list_teacher_payments";
    public const string CreateExpense = "create_expense";
    public const string ListExpenses = "list_expenses";
    public const string QueryDebtors = "query_debtors";
    public const string AddCatalogItem = "add_catalog_item";

    private static readonly JsonSerializerOptions SchemaOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    public static IReadOnlyList<FunctionToolDefinition> Definitions { get; } = Build();

    private static List<FunctionToolDefinition> Build() =>
    [
        new FunctionToolDefinition(
            name: GetCatalog,
            description: "Returns the valid values of a catalog. Call before creating a schedule "
                + "or registering a payment to use only valid course/level/weekday/payment-method values.",
            parameters: Schema(new
            {
                Type = "object",
                Properties = new
                {
                    Code = new
                    {
                        Type = "string",
                        Enum = new[] { "courses", "levels", "weekdays", "paymentMethods" },
                        Description = "Catalog code to read.",
                    },
                },
                Required = new[] { "code" },
            })),

        new FunctionToolDefinition(
            name: QuerySchedules,
            description: "Lists the active schedules (course, level, teacher, weekdays, time, seats)."),

        new FunctionToolDefinition(
            name: QuerySessions,
            description: "Lists the class sessions on a specific date (default: today) across all active "
                + "schedules, including course, level, teacher, time and session status "
                + "(scheduled/completed/cancelled). Use this to answer about \"clases de hoy\" or the "
                + "sessions of any given day — sessions are the source of truth, not the schedule weekdays.",
            parameters: Schema(new
            {
                Type = "object",
                Properties = new
                {
                    Date = new
                    {
                        Type = "string",
                        Description = "Day to list, \"yyyy-MM-dd\". Optional; defaults to today (America/Lima).",
                    },
                },
                Required = Array.Empty<string>(),
            })),

        new FunctionToolDefinition(
            name: ListTeachers,
            description: "Lists teachers, optionally filtered by a name/specialty search. Use it to "
                + "resolve a teacherId from a teacher name before creating a schedule.",
            parameters: Schema(new
            {
                Type = "object",
                Properties = new
                {
                    Search = new
                    {
                        Type = "string",
                        Description = "Free-text filter by teacher name or specialty. Optional.",
                    },
                },
                Required = Array.Empty<string>(),
            })),

        new FunctionToolDefinition(
            name: ListStudents,
            description: "Lists students, optionally filtered by a name/document search. Use it to "
                + "resolve a studentId before finding their enrollments.",
            parameters: Schema(new
            {
                Type = "object",
                Properties = new
                {
                    Search = new
                    {
                        Type = "string",
                        Description = "Free-text filter by student name or document number. Optional.",
                    },
                },
                Required = Array.Empty<string>(),
            })),

        new FunctionToolDefinition(
            name: FindEnrollments,
            description: "Finds active enrollments filtered by studentId and/or scheduleId. Use it to "
                + "resolve the enrollmentId required to register a payment.",
            parameters: Schema(new
            {
                Type = "object",
                Properties = new
                {
                    StudentId = new
                    {
                        Type = "string",
                        Description = "Filter by student id. Optional.",
                    },
                    ScheduleId = new
                    {
                        Type = "string",
                        Description = "Filter by schedule id. Optional.",
                    },
                },
                Required = Array.Empty<string>(),
            })),

        new FunctionToolDefinition(
            name: QuerySchedulePayments,
            description: "Returns the per-student payment status of a schedule: each active enrollment with "
                + "its total price (amount), how much the student has paid (paidAmount) and the outstanding "
                + "balance (pendingAmount), all computed by the backend. ALWAYS use this tool to answer "
                + "\"cuánto pagó / cuánto debe cada estudiante\" — never derive balances from the price yourself. "
                + "Resolve the scheduleId first via query_schedules.",
            parameters: Schema(new
            {
                Type = "object",
                Properties = new
                {
                    ScheduleId = new
                    {
                        Type = "string",
                        Description = "Id of the schedule to report payment status for. Required.",
                    },
                    Status = new
                    {
                        Type = "string",
                        Enum = new[] { "active", "completed", "cancelled", "pending" },
                        Description = "Optional enrollment status filter. Defaults to active.",
                    },
                },
                Required = new[] { "scheduleId" },
            })),

        new FunctionToolDefinition(
            name: CreateSchedule,
            description: "Creates a new schedule. Resolve teacherId via list_teachers and validate "
                + "course/level/weekdays via get_catalog first. Confirm the details with the user before calling.",
            parameters: Schema(new
            {
                Type = "object",
                Properties = new
                {
                    Course = new { Type = "string", Description = "Course value from the 'courses' catalog." },
                    Level = new { Type = "string", Description = "Level value from the 'levels' catalog." },
                    TeacherId = new { Type = "string", Description = "Teacher id resolved via list_teachers." },
                    Weekdays = new
                    {
                        Type = "string",
                        Description = "Canonical weekday code: L, Ma, Mi, J, V, S, D, LMiV, MaJ, L-V or SD.",
                    },
                    StartTime = new { Type = "string", Description = "Start time, 24h \"HH:mm:ss\" (e.g. \"18:00:00\")." },
                    EndTime = new { Type = "string", Description = "End time, 24h \"HH:mm:ss\". Must be later than startTime." },
                    Price = new { Type = "number", Description = "Price per enrollment. Non-negative." },
                    Capacity = new { Type = "integer", Description = "Maximum number of seats. Greater than zero." },
                    StartDate = new { Type = "string", Description = "Start date \"yyyy-MM-dd\"." },
                },
                Required = new[] { "course", "level", "teacherId", "weekdays", "startTime", "endTime", "price", "capacity", "startDate" },
            })),

        new FunctionToolDefinition(
            name: CreateStudent,
            description: "Creates a new student record. Before calling, check with list_students that the "
                + "student does not already exist (search by name or document). Confirm the data with the "
                + "user before calling. Returns the created student including its id and code (EST-XXXXX).",
            parameters: Schema(new
            {
                Type = "object",
                Properties = new
                {
                    FirstName = new { Type = "string", Description = "Student first name(s)." },
                    LastName = new { Type = "string", Description = "Student last name(s)." },
                    DocType = new
                    {
                        Type = "string",
                        Enum = new[] { "dni", "ce", "passport" },
                        Description = "Document type. \"dni\" for Peruvian ID (8 digits).",
                    },
                    DocNumber = new { Type = "string", Description = "Document number. DNI = 8 digits." },
                    Phone = new { Type = "string", Description = "Contact phone. Optional." },
                    Email = new { Type = "string", Description = "Email. Optional." },
                    Source = new { Type = "string", Description = "How the student arrived (catalog 'studentSources'). Optional." },
                    Notes = new { Type = "string", Description = "Free-text notes. Optional." },
                },
                Required = new[] { "firstName", "lastName", "docType", "docNumber" },
            })),

        new FunctionToolDefinition(
            name: CreateEnrollment,
            description: "Enrolls a student into a schedule (matrícula). Resolve studentId via list_students "
                + "(or create_student for a new student) and scheduleId via query_schedules first. The server "
                + "rejects duplicates and full schedules. Confirm with the user before calling. Returns the "
                + "enrollment including its id (needed to register a payment) and code (INS-XXXXX).",
            parameters: Schema(new
            {
                Type = "object",
                Properties = new
                {
                    StudentId = new { Type = "string", Description = "Student id resolved via list_students/create_student." },
                    ScheduleId = new { Type = "string", Description = "Schedule id resolved via query_schedules." },
                    EnrollmentDate = new { Type = "string", Description = "Enrollment date \"yyyy-MM-dd\". Use today unless told otherwise." },
                },
                Required = new[] { "studentId", "scheduleId", "enrollmentDate" },
            })),

        new FunctionToolDefinition(
            name: RegisterStudentPayment,
            description: "Registers a student payment against an active enrollment. Resolve enrollmentId via "
                + "find_enrollments first. Confirm amount and enrollment with the user before calling.",
            parameters: Schema(new
            {
                Type = "object",
                Properties = new
                {
                    EnrollmentId = new { Type = "string", Description = "Active enrollment id from find_enrollments." },
                    Date = new { Type = "string", Description = "Payment date \"yyyy-MM-dd\"." },
                    Amount = new { Type = "number", Description = "Amount paid. Greater than zero." },
                    InstallmentNumber = new { Type = "integer", Description = "Installment number, 1 or greater." },
                    PaymentMethod = new { Type = "string", Description = "Payment method value from the 'paymentMethods' catalog." },
                    HasReceipt = new { Type = "boolean", Description = "Whether a receipt was issued." },
                    ReceiptNumber = new { Type = "string", Description = "Receipt number. Optional." },
                    Notes = new { Type = "string", Description = "Free-text notes. Optional." },
                },
                Required = new[] { "enrollmentId", "date", "amount", "installmentNumber", "paymentMethod", "hasReceipt" },
            })),

        // ------------------------------------------------------ teachers (write)

        new FunctionToolDefinition(
            name: GetTeacher,
            description: "Returns the full detail of one teacher by id (name, document, phone, email, "
                + "specialty, status). Use it to read current values before update_teacher, or to answer "
                + "questions about a specific teacher. Resolve the id via list_teachers first.",
            parameters: Schema(new
            {
                Type = "object",
                Properties = new
                {
                    Id = new { Type = "string", Description = "Teacher id resolved via list_teachers." },
                },
                Required = new[] { "id" },
            })),

        new FunctionToolDefinition(
            name: CreateTeacher,
            description: "Creates a new teacher (profesor). Before calling, check with list_teachers that the "
                + "teacher does not already exist. Confirm the data with the user before calling. Returns the "
                + "created teacher including its id and code (PRO-XXXXX).",
            parameters: Schema(new
            {
                Type = "object",
                Properties = new
                {
                    FirstName = new { Type = "string", Description = "Teacher first name(s)." },
                    LastName = new { Type = "string", Description = "Teacher last name(s)." },
                    DocType = new
                    {
                        Type = "string",
                        Enum = new[] { "dni", "ce", "passport" },
                        Description = "Document type. \"dni\" for Peruvian ID (8 digits).",
                    },
                    DocNumber = new { Type = "string", Description = "Document number. DNI = 8 digits." },
                    Phone = new { Type = "string", Description = "Contact phone. Optional." },
                    Email = new { Type = "string", Description = "Email. Optional." },
                    Specialty = new { Type = "string", Description = "Teaching specialty. Optional." },
                },
                Required = new[] { "firstName", "lastName", "docType", "docNumber" },
            })),

        new FunctionToolDefinition(
            name: UpdateTeacher,
            description: "Updates an existing teacher. Only send the fields you want to change; the backend keeps "
                + "the rest. Resolve the id via list_teachers (or get_teacher to read current values). Confirm the "
                + "change with the user before calling. This never deletes — to retire a teacher set active=false.",
            parameters: Schema(new
            {
                Type = "object",
                Properties = new
                {
                    Id = new { Type = "string", Description = "Teacher id to update." },
                    FirstName = new { Type = "string", Description = "New first name(s). Optional." },
                    LastName = new { Type = "string", Description = "New last name(s). Optional." },
                    DocType = new
                    {
                        Type = "string",
                        Enum = new[] { "dni", "ce", "passport" },
                        Description = "New document type. Optional.",
                    },
                    DocNumber = new { Type = "string", Description = "New document number. Optional." },
                    Phone = new { Type = "string", Description = "New contact phone. Optional." },
                    Email = new { Type = "string", Description = "New email. Optional." },
                    Specialty = new { Type = "string", Description = "New specialty. Optional." },
                    Active = new { Type = "boolean", Description = "Set false to deactivate (soft) the teacher. Optional." },
                },
                Required = new[] { "id" },
            })),

        // ------------------------------------------------------ students (write)

        new FunctionToolDefinition(
            name: UpdateStudent,
            description: "Updates an existing student. Only send the fields you want to change; the backend keeps "
                + "the rest. Resolve the id via list_students. Confirm the change with the user before calling. "
                + "This never deletes — to retire a student set active=false.",
            parameters: Schema(new
            {
                Type = "object",
                Properties = new
                {
                    Id = new { Type = "string", Description = "Student id to update." },
                    FirstName = new { Type = "string", Description = "New first name(s). Optional." },
                    LastName = new { Type = "string", Description = "New last name(s). Optional." },
                    DocType = new
                    {
                        Type = "string",
                        Enum = new[] { "dni", "ce", "passport" },
                        Description = "New document type. Optional.",
                    },
                    DocNumber = new { Type = "string", Description = "New document number. Optional." },
                    Phone = new { Type = "string", Description = "New contact phone. Optional." },
                    Email = new { Type = "string", Description = "New email. Optional." },
                    Source = new { Type = "string", Description = "New source (catalog 'studentSources'). Optional." },
                    Notes = new { Type = "string", Description = "New free-text notes. Optional." },
                    Active = new { Type = "boolean", Description = "Set false to deactivate (soft) the student. Optional." },
                },
                Required = new[] { "id" },
            })),

        // ------------------------------------------------------ schedules (write/read)

        new FunctionToolDefinition(
            name: UpdateSchedule,
            description: "Updates an existing schedule (price, capacity, status, teacher, times, weekdays...). "
                + "Only send the fields you want to change; the backend keeps the rest. Changing dates/times/weekdays "
                + "may regenerate future sessions and can be rejected (409) if finalized sessions would be lost. "
                + "Resolve the id via query_schedules. Confirm the change with the user before calling.",
            parameters: Schema(new
            {
                Type = "object",
                Properties = new
                {
                    Id = new { Type = "string", Description = "Schedule id to update." },
                    Course = new { Type = "string", Description = "New course (catalog 'courses'). Optional." },
                    Level = new { Type = "string", Description = "New level (catalog 'levels'). Optional." },
                    TeacherId = new { Type = "string", Description = "New teacher id (list_teachers). Optional." },
                    Weekdays = new { Type = "string", Description = "New weekday code (L, Ma, Mi, J, V, S, D, LMiV, MaJ, L-V, SD). Optional." },
                    StartTime = new { Type = "string", Description = "New start time \"HH:mm:ss\". Optional." },
                    EndTime = new { Type = "string", Description = "New end time \"HH:mm:ss\". Optional." },
                    Price = new { Type = "number", Description = "New price per enrollment. Optional." },
                    Capacity = new { Type = "integer", Description = "New seat capacity. Optional." },
                    Status = new
                    {
                        Type = "string",
                        Enum = new[] { "active", "inProgress", "finished", "cancelled" },
                        Description = "New schedule status. Optional.",
                    },
                    StartDate = new { Type = "string", Description = "New start date \"yyyy-MM-dd\". Optional." },
                },
                Required = new[] { "id" },
            })),

        new FunctionToolDefinition(
            name: QueryScheduleDashboard,
            description: "Returns the operational dashboard of one schedule for a given month: sessions, "
                + "attendance and payment roll-up computed by the backend. Use it to answer questions about a "
                + "schedule's month. Resolve the scheduleId via query_schedules first.",
            parameters: Schema(new
            {
                Type = "object",
                Properties = new
                {
                    ScheduleId = new { Type = "string", Description = "Schedule id to report on. Required." },
                    Month = new { Type = "string", Description = "Month \"yyyy-MM\" (e.g. \"2026-05\"). Optional; defaults to current month." },
                },
                Required = new[] { "scheduleId" },
            })),

        // -------------------------------------------- enrollments (write)

        new FunctionToolDefinition(
            name: UpdateEnrollment,
            description: "Updates an existing enrollment (matrícula): change its status (e.g. to completed or "
                + "cancelled) or its agreed price. Only send the fields you want to change. Resolve the id via "
                + "find_enrollments. Confirm the change with the user before calling. This never deletes — to "
                + "cancel a matrícula set status=cancelled.",
            parameters: Schema(new
            {
                Type = "object",
                Properties = new
                {
                    Id = new { Type = "string", Description = "Enrollment id to update." },
                    Status = new
                    {
                        Type = "string",
                        Enum = new[] { "active", "completed", "cancelled", "pending" },
                        Description = "New enrollment status. Optional.",
                    },
                    SchedulePrice = new { Type = "number", Description = "New agreed price for this enrollment. Optional." },
                    EnrollmentDate = new { Type = "string", Description = "New enrollment date \"yyyy-MM-dd\". Optional." },
                },
                Required = new[] { "id" },
            })),

        // -------------------------------------------- student payments (read/write)

        new FunctionToolDefinition(
            name: ListStudentPayments,
            description: "Lists individual student payments, filtered by enrollmentId and/or studentId and/or a "
                + "date range (from/to). Use it to review a student's payment history. To see per-student pending "
                + "balances of a whole schedule use query_schedule_payments instead.",
            parameters: Schema(new
            {
                Type = "object",
                Properties = new
                {
                    EnrollmentId = new { Type = "string", Description = "Filter by enrollment id. Optional." },
                    StudentId = new { Type = "string", Description = "Filter by student id. Optional." },
                    From = new { Type = "string", Description = "Start date \"yyyy-MM-dd\" (inclusive). Optional." },
                    To = new { Type = "string", Description = "End date \"yyyy-MM-dd\" (inclusive). Optional." },
                },
                Required = Array.Empty<string>(),
            })),

        new FunctionToolDefinition(
            name: UpdateStudentPayment,
            description: "Corrects an existing student payment (amount, date, method, installment, receipt, notes). "
                + "The linked enrollment and its snapshots are frozen and cannot change. Only send the fields you "
                + "want to change. Resolve the payment id via list_student_payments. Confirm with the user before "
                + "calling. This never deletes.",
            parameters: Schema(new
            {
                Type = "object",
                Properties = new
                {
                    Id = new { Type = "string", Description = "Student payment id to update." },
                    Date = new { Type = "string", Description = "New payment date \"yyyy-MM-dd\". Optional." },
                    Amount = new { Type = "number", Description = "New amount. Optional." },
                    InstallmentNumber = new { Type = "integer", Description = "New installment number. Optional." },
                    PaymentMethod = new { Type = "string", Description = "New payment method (catalog 'paymentMethods'). Optional." },
                    HasReceipt = new { Type = "boolean", Description = "Whether a receipt was issued. Optional." },
                    ReceiptNumber = new { Type = "string", Description = "New receipt number. Optional." },
                    Notes = new { Type = "string", Description = "New free-text notes. Optional." },
                },
                Required = new[] { "id" },
            })),

        // -------------------------------------------- teacher payments (read/write)

        new FunctionToolDefinition(
            name: CreateTeacherPayment,
            description: "Registers a payment made TO a teacher (honorarios). Resolve teacherId via list_teachers "
                + "first. Confirm amount and teacher with the user before calling.",
            parameters: Schema(new
            {
                Type = "object",
                Properties = new
                {
                    TeacherId = new { Type = "string", Description = "Teacher id from list_teachers." },
                    Date = new { Type = "string", Description = "Payment date \"yyyy-MM-dd\"." },
                    Amount = new { Type = "number", Description = "Amount paid to the teacher. Greater than zero." },
                    Concept = new { Type = "string", Description = "What the payment is for. Optional." },
                    PaymentMethod = new { Type = "string", Description = "Payment method (catalog 'paymentMethods'). Optional." },
                    Notes = new { Type = "string", Description = "Free-text notes. Optional." },
                },
                Required = new[] { "teacherId", "date", "amount" },
            })),

        new FunctionToolDefinition(
            name: ListTeacherPayments,
            description: "Lists payments made to teachers, filtered by teacherId and/or a date range (from/to). "
                + "Use it to review how much has been paid to a teacher.",
            parameters: Schema(new
            {
                Type = "object",
                Properties = new
                {
                    TeacherId = new { Type = "string", Description = "Filter by teacher id. Optional." },
                    From = new { Type = "string", Description = "Start date \"yyyy-MM-dd\" (inclusive). Optional." },
                    To = new { Type = "string", Description = "End date \"yyyy-MM-dd\" (inclusive). Optional." },
                },
                Required = Array.Empty<string>(),
            })),

        // -------------------------------------------- expenses (read/write)

        new FunctionToolDefinition(
            name: CreateExpense,
            description: "Registers a general expense (gasto). Optionally link it to a schedule via scheduleId. "
                + "Confirm amount and description with the user before calling.",
            parameters: Schema(new
            {
                Type = "object",
                Properties = new
                {
                    Date = new { Type = "string", Description = "Expense date \"yyyy-MM-dd\"." },
                    Amount = new { Type = "number", Description = "Expense amount. Greater than zero." },
                    Category = new { Type = "string", Description = "Expense category (catalog 'expenseCategories'). Optional." },
                    Description = new { Type = "string", Description = "What the expense is for. Optional." },
                    PaymentMethod = new { Type = "string", Description = "Payment method (catalog 'paymentMethods'). Optional." },
                    ScheduleId = new { Type = "string", Description = "Schedule id this expense belongs to. Optional." },
                    Notes = new { Type = "string", Description = "Free-text notes. Optional." },
                },
                Required = new[] { "date", "amount" },
            })),

        new FunctionToolDefinition(
            name: ListExpenses,
            description: "Lists general expenses, filtered by a date range (from/to), category and/or scheduleId. "
                + "Use it to review spending.",
            parameters: Schema(new
            {
                Type = "object",
                Properties = new
                {
                    From = new { Type = "string", Description = "Start date \"yyyy-MM-dd\" (inclusive). Optional." },
                    To = new { Type = "string", Description = "End date \"yyyy-MM-dd\" (inclusive). Optional." },
                    Category = new { Type = "string", Description = "Filter by category. Optional." },
                    ScheduleId = new { Type = "string", Description = "Filter by linked schedule id. Optional." },
                },
                Required = Array.Empty<string>(),
            })),

        // -------------------------------------------- operational / catalog

        new FunctionToolDefinition(
            name: QueryDebtors,
            description: "Lists the active enrollments of a schedule that have NO payment in a given month "
                + "(deudores del mes). Both scheduleId and month are required. Resolve the scheduleId via "
                + "query_schedules first.",
            parameters: Schema(new
            {
                Type = "object",
                Properties = new
                {
                    ScheduleId = new { Type = "string", Description = "Schedule id to check. Required." },
                    Month = new { Type = "string", Description = "Month \"yyyy-MM\" (e.g. \"2026-05\"). Required." },
                },
                Required = new[] { "scheduleId", "month" },
            })),

        new FunctionToolDefinition(
            name: AddCatalogItem,
            description: "Adds a new value to a catalog (e.g. a new course, level, payment method, expense "
                + "category or student source). Check first with get_catalog that the value does not already "
                + "exist. Confirm with the user before calling. This only adds — it never removes or disables values.",
            parameters: Schema(new
            {
                Type = "object",
                Properties = new
                {
                    Code = new { Type = "string", Description = "Catalog code to add to (e.g. \"courses\", \"levels\", \"paymentMethods\", \"expenseCategories\", \"studentSources\")." },
                    Value = new { Type = "string", Description = "The new value to add." },
                    Order = new { Type = "integer", Description = "Optional display order." },
                },
                Required = new[] { "code", "value" },
            })),
    ];

    private static BinaryData Schema(object schema) => BinaryData.FromObjectAsJson(schema, SchemaOptions);
}
