# Ops Training Quickstart

## Daily checks
1. Open `/admin/ops/dashboard`
2. Open `/admin/ops/alerts`
3. Check latest reconciliation jobs
4. Check bulk notification failed recipients

## Common incidents
- Patient cannot see attachment:
  - verify scan status is `CLEAN`
  - verify not revoked/deleted
- Bulk notification delay:
  - inspect batch status
  - retry failed recipients
- Waitlist complaint:
  - verify hold status and expiry
  - confirm claim-hold flow
- Payment mismatch:
  - run daily reconciliation
  - follow mismatch list

## Escalation
- If SEV-1 condition is detected, page backend on-call immediately.

