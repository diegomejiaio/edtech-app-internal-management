# Sequence Diagram — Enrollment Creation (with optional initial payment)

> Companion to `02-architecture.md` §6.1 and `04-api-design.md` §5.5 / §5.6.
> Covers: dedup validation, snapshot population, optional 2nd call for initial payment.
> Decision: enrollment + payment are **two separate calls**, NOT atomic. Trade-off documented in `02-architecture.md` §6.1.

---

## 1. Happy path — new enrollment + initial payment

```mermaid
sequenceDiagram
    autonumber
    actor U as Admin
    participant FE as Next.js SPA
    participant FX as Function App<br/>(JwtAuth + Correlation)
    participant ENR as EnrollmentsFunction
    participant SCH as ScheduleRepo
    participant STU as StudentRepo
    participant ENRR as EnrollmentRepo
    participant PAY as StudentPaymentsFunction
    participant PAYR as StudentPaymentRepo
    participant DB as Cosmos DB<br/>(operations + master)

    U->>FE: fill enrollment form<br/>(student, schedule, optional initial payment)
    FE->>FX: POST /api/v1/enrollments<br/>{ studentId, scheduleId, enrollmentDate, status: "active" }
    FX->>FX: JWT valid, role=admin
    FX->>ENR: invoke

    Note over ENR: Step 1 — dedup check (single-partition, ~3 RU)
    ENR->>ENRR: existsActive(studentId, scheduleId)
    ENRR->>DB: SELECT VALUE COUNT(1) FROM c<br/>WHERE c.type='enrollment'<br/>AND c.studentId=@s AND c.scheduleId=@sch<br/>AND c.status='active' AND c.active=true
    DB-->>ENRR: count
    ENRR-->>ENR: bool

    alt count > 0 (duplicate)
        ENR-->>FX: 409 + ProblemDetails<br/>type: urn:espaciopro:problem:duplicate<br/>detail: "Active enrollment already exists for this student+schedule"
        FX-->>FE: 409
        FE-->>U: show error, abort
    end

    Note over ENR: Step 2 — fetch FK snapshots (2 point reads, ~2 RU)
    par Snapshot lookups
        ENR->>STU: getById(studentId)
        STU->>DB: read (master, type='student')
        DB-->>STU: Student
        STU-->>ENR: Student
    and
        ENR->>SCH: getById(scheduleId)
        SCH->>DB: read (master, type='schedule')
        DB-->>SCH: Schedule
        SCH-->>ENR: Schedule
    end

    alt student missing OR not active OR schedule missing OR not active
        ENR-->>FX: 422 + ProblemDetails<br/>type: urn:espaciopro:problem:validation<br/>errors: { studentId|scheduleId: [...] }
        FX-->>FE: 422
    end

    Note over ENR: Step 3 — build entity with snapshots
    ENR->>ENR: build Enrollment {<br/>  studentName: stu.firstName+' '+stu.lastName,<br/>  studentDoc: stu.docType+' '+stu.docNumber,<br/>  scheduleName: sch.course+' · '+sch.level+' · '+sch.weekdays+' '+sch.startTime,<br/>  schedulePrice: sch.price,<br/>  ...input<br/>}

    ENR->>ENRR: create(enrollment)
    Note over ENRR: CosmosRepository auto-populates<br/>id, type, active=true, createdAt/By, updatedAt/By
    ENRR->>DB: CreateItem (operations, type='enrollment')
    DB-->>ENRR: ItemResponse + _etag
    ENRR-->>ENR: Enrollment with id + _etag

    ENR-->>FX: 201 Created<br/>Location: /api/v1/enrollments/{id}<br/>Body: full Enrollment
    FX-->>FE: 201 + body

    opt Initial payment provided
        FE->>FX: POST /api/v1/student-payments<br/>{ enrollmentId, date, amount, installmentNumber: 1, paymentMethod, ... }
        FX->>PAY: invoke
        PAY->>ENRR: getById(enrollmentId)
        ENRR->>DB: read
        DB-->>ENRR: Enrollment (with snapshots)
        ENRR-->>PAY: Enrollment

        Note over PAY: Snapshot for payment (frozen forever):<br/>studentId, studentName, scheduleId, scheduleName
        PAY->>PAY: build StudentPayment with frozen snapshots
        PAY->>PAYR: create(payment)
        PAYR->>DB: CreateItem
        DB-->>PAYR: ItemResponse
        PAYR-->>PAY: payment

        PAY-->>FX: 201 + Location
        FX-->>FE: 201
    end

    FE-->>U: success toast, navigate to enrollment detail
```

---

## 2. Failure path — payment fails after enrollment succeeds

```mermaid
sequenceDiagram
    actor U as Admin
    participant FE as Next.js SPA
    participant FX as Function App

    FE->>FX: POST /enrollments → 201 (enrollment created)
    FE->>FX: POST /student-payments → 422 (invalid amount)
    FX-->>FE: 422
    FE-->>U: warn "Inscripción creada, pero el pago falló. Intenta registrar el pago manualmente."

    Note over FE,U: Enrollment is NOT rolled back.<br/>Trade-off accepted (see 02-architecture §6.1).<br/>Admin can retry payment from enrollment detail screen.
```

---

## 3. Edge case — concurrent duplicate creation

```mermaid
sequenceDiagram
    participant FE1 as Tab A
    participant FE2 as Tab B
    participant FX as Function App
    participant DB as Cosmos

    par
        FE1->>FX: POST /enrollments {studentX, scheduleY, active}
    and
        FE2->>FX: POST /enrollments {studentX, scheduleY, active}
    end

    FX->>DB: dedup query (Tab A) → 0 results
    FX->>DB: dedup query (Tab B) → 0 results
    FX->>DB: insert (Tab A) → success
    FX->>DB: insert (Tab B) → success (race window)

    Note over DB: ⚠️ Both inserts succeed.<br/>v1 has NO Cosmos unique key on (studentId, scheduleId, status).<br/>This race is documented as accepted risk for v1<br/>(single admin user, very low concurrency).
```

> **If duplicate-active race becomes real**: add a server-side lock via Cosmos optimistic concurrency on a "lock doc", or define a Cosmos unique key over a synthetic `enrollmentDedupKey = studentId + '_' + scheduleId` populated only when `status='active' AND active=true`. Out of scope v1.

---

## 4. Notes

- **Dedup check** is a separate query before insert. Cost: ~3 RU. Acceptable.
- **Snapshot freshness**: `studentName`, `scheduleName`, `schedulePrice` are written at create time and refreshed on `PUT /enrollments/{id}`. Stale snapshots accepted (same audit pattern as `AuditUser`). See `04-api-design.md` §4.2.
- **Payment snapshots are FROZEN**: `studentName`, `scheduleName` on `StudentPayment` never refresh — payment is a historical fact.
- **Concurrency control on PUT**: `Enrollment` PUT requires `If-Match` header (cheatsheet §7). POST does not.
- **Total RU per happy path**: ~3 (dedup) + ~2 (snapshots) + ~5 (insert) = **~10 RU per enrollment**. With initial payment: +5 RU = ~15 RU total.
