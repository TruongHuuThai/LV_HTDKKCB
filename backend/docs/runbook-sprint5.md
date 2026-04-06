# Sprint 5 Runbook

## 1) Payment mismatch
- Run: `node scripts/diagnose-data-quality.js`
- Check API: `GET /admin/reconciliation/daily?date=YYYY-MM-DD`
- Open issues: `GET /admin/reconciliation/:jobId`
- If webhook backlog exists, verify `PAYMENT_WEBHOOK_EVENT` rows in `FAILED`.

## 2) Bulk notification stuck
- Check dashboard: `GET /admin/ops/dashboard`
- Check alerts: `GET /admin/ops/alerts`
- Inspect batch: `GET /admin/notifications/bulk/:batchId`
- Inspect recipients: `GET /admin/notifications/bulk/:batchId/recipients`
- Retry failed recipients: `POST /admin/notifications/bulk/:batchId/retry` with `{"onlyFailed":"true"}`

## 3) Waitlist hold stuck
- Background worker rotates expired holds automatically.
- Verify expired holds moved to `EXPIRED` and next candidate becomes `HOLDING`.
- Patient claim flow: `POST /waitlist/:waitlistId/claim-hold`

## 4) Attachment security incident
- Revoke/delete attachment via patient flow or admin DB action.
- `PVA_SCAN_STATUS=INFECTED` blocks access URL generation.
- `PVA_REVOKED_AT` blocks signed access even with old token.

## 5) Rollback notes
- If migration issues: rollback DB migration first.
- Disable workers quickly via env:
  - `APPOINTMENT_BACKGROUND_WORKER_ENABLED=false`
  - `APPOINTMENT_NOTIFICATION_AUTOMATION_ENABLED=false`
- Keep webhook endpoint active to avoid payment status drift.

