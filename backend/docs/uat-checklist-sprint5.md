# UAT Checklist Sprint 5

## Core flows
- Booking, reschedule, cancel, payment, refund.
- Doctor worklist and status updates.
- Patient pre-visit info and attachments.
- Waitlist join, hold notification, claim hold.
- Admin bulk notification (queue + retry failed).

## Security
- Patient cannot access other patient attachment.
- Doctor only sees own appointment pre-visit info.
- Admin-only endpoints blocked for non-admin.
- Signed attachment URL expires as expected.

## Reliability
- Duplicate payment webhook ignored idempotently.
- Bulk batch progresses `QUEUED -> PROCESSING -> COMPLETED/PARTIAL_FAILED/FAILED`.
- Expired waitlist hold rotates to next candidate.
- Daily reconciliation creates mismatch records when needed.

## Ops
- `GET /admin/ops/dashboard` returns metrics.
- `GET /admin/ops/alerts` returns operational alerts.
- Data quality diagnostic script runs successfully.

