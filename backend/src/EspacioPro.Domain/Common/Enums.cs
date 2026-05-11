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
