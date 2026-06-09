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
    public const string ListTeachers = "list_teachers";
    public const string ListStudents = "list_students";
    public const string FindEnrollments = "find_enrollments";
    public const string CreateSchedule = "create_schedule";
    public const string RegisterStudentPayment = "register_student_payment";

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
    ];

    private static BinaryData Schema(object schema) => BinaryData.FromObjectAsJson(schema, SchemaOptions);
}
