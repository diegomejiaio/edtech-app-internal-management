using EspacioPro.Api.Attributes;
using EspacioPro.Infrastructure.Cosmos.Repositories;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Extensions.Logging;

namespace EspacioPro.Api.Functions;

/// <summary>
/// Admin/maintenance endpoints. All require <c>[RequireRole("admin")]</c>.
/// </summary>
public sealed class AdminFunction
{
    private readonly StudentRepository _students;
    private readonly TeacherRepository _teachers;
    private readonly ScheduleRepository _schedules;
    private readonly ExpenseRepository _expenses;
    private readonly ILogger<AdminFunction> _logger;

    public AdminFunction(
        StudentRepository students,
        TeacherRepository teachers,
        ScheduleRepository schedules,
        ExpenseRepository expenses,
        ILogger<AdminFunction> logger)
    {
        _students = students;
        _teachers = teachers;
        _schedules = schedules;
        _expenses = expenses;
        _logger = logger;
    }

    /// <summary>
    /// POST /api/v1/admin/reindex — recomputes <c>searchText</c> for every
    /// student, teacher, schedule, and expense document (including inactive).
    /// Used to backfill existing data after the search normalization logic
    /// changes. Audit fields are preserved.
    /// </summary>
    [Function("AdminReindex")]
    [RequireRole("admin")]
    public async Task<IActionResult> Reindex(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "v1/admin/reindex")] HttpRequest req,
        CancellationToken ct)
    {
        _logger.LogInformation("Reindex requested");

        var students = await _students.ReindexAllAsync(ct);
        var teachers = await _teachers.ReindexAllAsync(ct);
        var schedules = await _schedules.ReindexAllAsync(ct);
        var expenses = await _expenses.ReindexAllAsync(ct);

        return new OkObjectResult(new
        {
            students,
            teachers,
            schedules,
            expenses,
            total = students + teachers + schedules + expenses,
        });
    }
}
