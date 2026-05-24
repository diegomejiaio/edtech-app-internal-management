namespace EspacioPro.Domain.Common;

/// <summary>
/// Document type. Wire format = camelCase string ("dni", "ce", "passport").
/// Per <c>docs/01-domain-model.md</c> §9.
/// </summary>
public enum DocType
{
    Dni,
    Ce,
    Passport
}

/// <summary>
/// Enrollment lifecycle status. Per <c>docs/01-domain-model.md</c> §9.
/// </summary>
public enum EnrollmentStatus
{
    Active,
    Completed,
    Cancelled,
    Pending
}

/// <summary>
/// Schedule lifecycle status. Per <c>docs/01-domain-model.md</c> §9.
/// </summary>
public enum ScheduleStatus
{
    Active,
    InProgress,
    Finished,
    Cancelled
}

/// <summary>
/// Generated schedule session status. Wire format = camelCase string.
/// </summary>
public enum ScheduleSessionStatus
{
    Scheduled,
    Completed,
    Cancelled
}

/// <summary>
/// Per-student attendance status inside a generated schedule session.
/// </summary>
public enum AttendanceStatus
{
    Pending,
    Present,
    Absent,
    Late
}
