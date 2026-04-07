# On-call SLA (Pilot and Go-live)

## Severity definitions
- `SEV-1`: Booking or payment unavailable for most users.
- `SEV-2`: Partial failure (bulk queue stuck, webhook failing, waitlist stuck).
- `SEV-3`: Non-critical degradation or reporting mismatch.

## Target response times
- `SEV-1`: acknowledge in 5 minutes, mitigation in 30 minutes.
- `SEV-2`: acknowledge in 15 minutes, mitigation in 2 hours.
- `SEV-3`: acknowledge in 4 hours, fix in next business day.

## Escalation path
1. On-call backend engineer
2. Platform/DB owner
3. Product owner + operations lead

## Incident playbook mapping
- Payment mismatch -> `runbook-sprint5.md` section 1
- Bulk stuck -> `runbook-sprint5.md` section 2
- Waitlist stuck -> `runbook-sprint5.md` section 3
- Attachment security incident -> `runbook-sprint5.md` section 4

