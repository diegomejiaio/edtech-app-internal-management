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

/// <summary>
/// WhatsApp conversation lifecycle. Wire format = camelCase string ("open", "pending", "closed").
/// Per <c>docs/10-whatsapp-crm-mvp.md</c> §1.
/// </summary>
public enum WaConversationStatus
{
    Open,
    Pending,
    Closed
}

/// <summary>
/// AI assistance mode for a WhatsApp conversation. Wire: "off", "assist", "autopilot".
/// </summary>
public enum WaAiMode
{
    Off,
    Assist,
    Autopilot
}

/// <summary>
/// Lead funnel state. Wire: "new", "interested", "visit", "enrolled", "paid", "noreply", "support".
/// </summary>
public enum WaLeadState
{
    New,
    Interested,
    Visit,
    Enrolled,
    Paid,
    Noreply,
    Support
}

/// <summary>
/// Origin of a WhatsApp message. Wire: "customer", "agent", "bot".
/// </summary>
public enum WaMessageSender
{
    Customer,
    Agent,
    Bot
}

/// <summary>
/// WhatsApp message media kind. MVP supports text only.
/// </summary>
public enum WaMessageKind
{
    Text
}

/// <summary>
/// Delivery status of a WhatsApp message. Wire: "sending", "sent", "delivered", "read", "failed".
/// </summary>
public enum WaMessageStatus
{
    Sending,
    Sent,
    Delivered,
    Read,
    Failed
}
