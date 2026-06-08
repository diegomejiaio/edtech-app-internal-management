using EspacioPro.Domain.Entities;

namespace EspacioPro.Seed;

/// <summary>
/// Carries cross-seeder state needed to resolve foreign keys (legacy Excel id →
/// newly generated GUID) and to derive denormalized snapshots (e.g. an
/// <c>Enrollment</c> needs the student's docNumber, a <c>StudentPayment</c>
/// needs the schedule id from its enrollment).
/// </summary>
internal sealed class SeedContext
{
    public Dictionary<string, Teacher> Teachers { get; } = new(StringComparer.OrdinalIgnoreCase);
    public Dictionary<string, Student> Students { get; } = new(StringComparer.OrdinalIgnoreCase);
    public Dictionary<string, Schedule> Schedules { get; } = new(StringComparer.OrdinalIgnoreCase);
    public Dictionary<string, Enrollment> Enrollments { get; } = new(StringComparer.OrdinalIgnoreCase);

    public Teacher Teacher(string excelId) =>
        Teachers.TryGetValue(excelId, out var t)
            ? t
            : throw new InvalidOperationException($"Teacher '{excelId}' not found in seed context.");

    public Student Student(string excelId) =>
        Students.TryGetValue(excelId, out var s)
            ? s
            : throw new InvalidOperationException($"Student '{excelId}' not found in seed context.");

    public Schedule Schedule(string excelId) =>
        Schedules.TryGetValue(excelId, out var s)
            ? s
            : throw new InvalidOperationException($"Schedule '{excelId}' not found in seed context.");

    public Enrollment Enrollment(string excelId) =>
        Enrollments.TryGetValue(excelId, out var e)
            ? e
            : throw new InvalidOperationException($"Enrollment '{excelId}' not found in seed context.");
}
