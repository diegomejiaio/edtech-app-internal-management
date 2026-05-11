# State Diagram — Schedule

> Status values are code-level enums in English on the wire (see `01-domain-model.md` §9 and `07-api-contract-cheatsheet.md` §5). UI labels are Spanish via i18n map.

```mermaid
stateDiagram-v2
    direction LR

    [*] --> Active : create (default, scheduled)
    Active --> InProgress : first session held
    InProgress --> Finished : last session held
    Active --> Cancelled : cancel before start
    InProgress --> Cancelled : cancel mid-course

    Finished --> [*]
    Cancelled --> [*]

    note right of InProgress
        UI uses this for "ongoing"
        filter when picking schedules
        for new enrollments.
    end note

    note left of Cancelled
        Active enrollments on a Cancelled
        schedule remain visible but
        flagged in the UI.
    end note
```
