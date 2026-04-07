# Stabilization Release Checklist

## Pre-release
- Confirm all latest migrations applied on staging.
- Confirm critical smoke tests pass:
  - booking lifecycle
  - payment webhook
  - refund update
  - bulk notification queue
  - waitlist hold + claim
  - attachment upload/access/delete
- Confirm `npm run build` and `npm test` pass.
- Confirm `npm run diagnose:data` has no critical blocker.

## Pilot rollout
- Verify pilot rollout config (`/admin/ops/pilot-rollout`) is correct.
- Keep pilot disabled until smoke test passes in production.
- Enable pilot cohort gradually.
- Monitor `/admin/ops/dashboard` and `/admin/ops/alerts`.

## Rollback
- Disable pilot rollout config.
- Disable background worker by env:
  - `APPOINTMENT_BACKGROUND_WORKER_ENABLED=false`
- Keep payment webhooks enabled.
- Revert deployment to previous stable build if critical errors persist.

## Post-release checks
- No spike in webhook failures.
- No spike in batch `FAILED/PARTIAL_FAILED`.
- No stuck waitlist holds beyond hold timeout.
- No open reconciliation mismatches above threshold.

