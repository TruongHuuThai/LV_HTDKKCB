# Load Test Plan Sprint 5

## Target endpoints
- `POST /booking`
- `PATCH /appointments/:appointmentId/reschedule`
- `POST /appointments/:appointmentId/cancel`
- `POST /appointments/:appointmentId/payment-retry`
- `POST /admin/notifications/bulk`
- `GET /admin/ops/dashboard`

## Peak scenario
- Simulate booking bursts by hour.
- Simulate cancellation waves that trigger waitlist hold flow.
- Simulate bulk notification sends with 1k recipients.
- Simulate duplicate payment webhook delivery.

## Success criteria
- No duplicate booking in same slot.
- No duplicate recipient delivery for the same batch-recipient key.
- Webhook duplicates do not mutate payment twice.
- Queue backlog drains within acceptable window.

## Execution notes
- Run against staging with production-like data volume.
- Keep DB metrics and API latency traces.
- Collect failed request samples and reconcile with audit logs.

