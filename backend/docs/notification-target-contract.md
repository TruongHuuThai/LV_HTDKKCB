# Notification Target Contract

## Target groups
- `ALL_USERS`
- `PATIENTS`
- `DOCTORS`
- `BY_SPECIALTY`
- `ADVANCED_FILTER`

## Quick presets
- `all_patients`
- `all_doctors`
- `all_users`
- `patients_today`
- `patients_tomorrow`

Preset được backend map về target/filter chuẩn trước khi resolve recipients.

## Filter schema
- `specialtyIds?: number[]`
- `doctorIds?: number[]`
- `appointmentIds?: number[]`
- `specificDate?: YYYY-MM-DD`
- `fromDate?: YYYY-MM-DD`
- `toDate?: YYYY-MM-DD`
- `scheduleId?: number`
- `slotId?: number`
- `appointmentStatuses?: string[]`
- `recipientScope?: PATIENTS | DOCTORS | ALL_USERS` (chủ yếu cho `ADVANCED_FILTER`)

## Preview contract
`POST /admin/notifications/bulk/preview`

Trả về:
- `quickPreset`
- `targetGroup`
- `recipientScope`
- `summaryText`
- `scopeSummary`
- `filterSummary`
- `resolvedFilter`
- `warnings`
- `emptyReason`
- `totalRecipients`
- `previewRecipients` (sample)

## Send contract
`POST /admin/notifications/bulk`

Trả về:
- `message`
- `batchId`
- `duplicatedRequest?`
- `totalRecipients`
- `status`
- `quickPreset`
- `targetGroup`
- `summaryText`
- `warnings`

## Validation rules
- `BY_SPECIALTY` bắt buộc có ít nhất 1 `specialtyId`.
- `ADVANCED_FILTER` bắt buộc có ít nhất 1 điều kiện meaningful.
- `specificDate` không đi cùng `fromDate/toDate`.
- `fromDate <= toDate`.

## Invariant quan trọng
- Preview và send dùng cùng `NotificationRecipientResolverService.resolve()` để đảm bảo đồng nhất phạm vi nhận.
