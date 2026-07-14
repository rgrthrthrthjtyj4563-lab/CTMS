# AIC-DCT AI Output Lifecycle

> Mirrors `packages/domain/src/ai.ts` and the `AIOutput` Prisma model. AI
> never produces a medical finality claim. Every output must be human-
> confirmed before it can become a formal clinical or operational record.

## Lifecycle Diagram

```
                     ┌──────────────────┐
                     │     Pending      │
                     └────────┬─────────┘
                              │
   ┌──────────────────────────┼──────────────────────────────┐
   │                          │                              │
   ▼                          ▼                              ▼
┌──────────────┐  ┌──────────────────────────┐  ┌──────────────────────┐
│  Adopted     │  │  EditedAdopted           │  │  Rejected (reason)   │
│  (terminal)  │  │  (terminal)              │  │  (terminal)          │
└──────────────┘  └──────────────────────────┘  └──────────────────────┘

   ┌──────────────────────────────┐
   │  NeedsInvestigatorConfirmation│
   └────────────┬─────────────────┘
                │ (PI/CRC must adopt/reject)
                ▼
       (back to Adopted | EditedAdopted | Rejected)
```

## State Transitions (from `AI_OUTPUT_TRANSITIONS`)

| From | To | Notes |
| --- | --- | --- |
| Pending | Adopted | Human accepts output as-is. |
| Pending | EditedAdopted | Human accepts with edits; the edited payload supersedes the AI payload. |
| Pending | Rejected | Requires non-empty `reason`. |
| Pending | NeedsInvestigatorConfirmation | Site staff (CRC) cannot adopt; routes to PI. |
| NeedsInvestigatorConfirmation | Adopted | PI adopts. |
| NeedsInvestigatorConfirmation | EditedAdopted | PI adopts with edits. |
| NeedsInvestigatorConfirmation | Rejected | PI rejects (requires reason). |
| Adopted | _(none)_ | Terminal. |
| EditedAdopted | _(none)_ | Terminal. |
| Rejected | _(none)_ | Terminal. |

## Mandatory Source Fields

Every `AIOutput` MUST carry:

- `model` and `modelVersion` (e.g. `claude-3.5-sonnet` / `2024-06-20`).
- `promptTemplateId` and `promptVersion`.
- `inputHash` (sha256 of the input prompt for replay).
- `knowledgeBaseRefs` (e.g. protocol version or knowledge base IDs).
- `generatedAt` timestamp.
- `confidence` (0..1) and `confidenceLevel` (`Low` / `Medium` / `High`).
- `status` (default `Pending`).
- `confirmedByUserId` and `confirmedAt` once a human acts on it.
- `rejectionReason` when rejected.

## UI / Display Rules

- AI-derived content must always be wrapped in an AI label (e.g.
  `AI 建议` / `AI 草稿`) so the user knows the source.
- The `confidence` value is shown via `formatConfidence()` (e.g. "高置信度
  （仅供参考，需人工复核）"). The label is deliberately non-medical and
  forbids words like 确诊/诊断.
- The `AIOutput` payload is never displayed as a final clinical record. It
  is rendered as a suggestion that the user may Adopt / Edit / Reject.

## Promotion Rules

`canPromoteAIOutput(output)` returns `true` only when status is
`Adopted` or `EditedAdopted`. Promotion means "this AI suggestion has been
turned into a formal record" — the originating AI label and the audit trail
are preserved on the formal record. The AI never replaces the PI judgment
or skips investigator confirmation for safety events.

Having adopt/reject endpoints is necessary but not sufficient. Every service endpoint that converts or references AI-derived content as a formal record MUST enforce the promotion rule server-side. At minimum this includes AI-derived protocol activation and report confirmation.

The promotion boundary MUST also verify that the AI output belongs to the same project and matches the expected output kind, target object, and version. `Pending`, `Rejected`, and `NeedsInvestigatorConfirmation` are rejected. A purely human-authored protocol or report uses an explicit non-AI path and MUST NOT create a fictitious AI output merely to satisfy this guard.

## Audit Chain

- `ai-output-generated` — written by the worker when the output is created.
- `ai-output-adopted` / `ai-output-edited-adopted` / `ai-output-rejected` —
  written by the API when the human acts.
- All audit events are linked to the `AIOutput.id` so a downstream mutation
  (e.g. an `RiskSignal` created from an AI output) can be traced back to
  the model, prompt version, and human confirmer.
