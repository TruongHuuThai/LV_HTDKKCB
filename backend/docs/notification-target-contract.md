# Notification Target Contract (Admin Bulk)

## Mục tiêu
Chuẩn hóa contract dùng chung cho:
- `POST /admin/notifications/bulk/preview`
- `POST /admin/notifications/bulk`

Hai API phải dùng cùng logic recipient resolver để tránh lệch phạm vi giữa preview và send.

## Target Groups
- `ALL_USERS`: Tất cả người dùng hoạt động có số điện thoại hợp lệ.
- `PATIENTS`: Nhóm bệnh nhân (toàn bộ hoặc theo điều kiện lịch hẹn).
- `DOCTORS`: Nhóm bác sĩ (toàn bộ hoặc lọc theo điều kiện).
- `BY_SPECIALTY`: Bác sĩ theo một hay nhiều chuyên khoa (bắt buộc có `specialtyIds`).
- `ADVANCED_FILTER`: Nhóm nâng cao, cần ít nhất một điều kiện lọc có ý nghĩa.

## Recipient Scope (chủ yếu cho ADVANCED_FILTER)
- `PATIENTS`
- `DOCTORS`
- `ALL_USERS`

## Request Payload (rút gọn)
```json
{
  "type": "system_admin",
  "title": "Thông báo",
  "message": "Nội dung thông báo",
  "targetGroup": "PATIENTS",
  "quickPreset": "patients_today",
  "filters": {
    "specialtyIds": [1, 2],
    "doctorIds": [101],
    "appointmentIds": [9001],
    "specificDate": "2026-04-18",
    "fromDate": "2026-04-18",
    "toDate": "2026-04-20",
    "scheduleId": 12,
    "slotId": 3,
    "appointmentStatuses": ["CHO_KHAM", "DA_CHECKIN"],
    "recipientScope": "PATIENTS"
  }
}
```

## Validation Rules
- `specificDate` không dùng cùng `fromDate/toDate`.
- `fromDate <= toDate`.
- `BY_SPECIALTY` bắt buộc có ít nhất 1 `specialtyIds`.
- `ADVANCED_FILTER` bắt buộc có ít nhất 1 điều kiện meaningful.

## Preview Response Fields (mới)
- `targetGroup`
- `recipientScope`
- `scopeSummary`
- `filterSummary`
- `warnings`
- `emptyReason`
- `totalRecipients`
- `previewRecipients` (sample giới hạn)
- `sampleRecipients` (legacy compatibility)

## Send Response Fields (mới)
- `batchId`
- `status`
- `totalRecipients`
- `targetGroup`
- `warnings`
- `duplicatedRequest` (nếu trùng idempotency gần đây)

## Backward Compatibility
Vẫn chấp nhận các field legacy:
- `doctorId`, `date`, `dateFrom`, `dateTo`, `specialtyId`, `appointmentIds`, `slotId`, `scheduleId`

Resolver sẽ normalize chung vào `filters` trước khi preview/send.

