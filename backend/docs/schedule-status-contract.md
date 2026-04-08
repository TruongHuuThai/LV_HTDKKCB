# Schedule Status Contract

Contract version: `2026-04-09.v2`

## 1) WeekStatus
- `generated`: Đã sinh dữ liệu tuần nhưng chưa sẵn sàng để bệnh nhân đặt lịch.
- `finalized`: Đã chốt tuần ở bước nghiệp vụ.
- `slot_opened`: Đã mở slot đặt lịch cho bệnh nhân.
- `closed`: Tuần đã đóng, không dùng cho booking mới.

## 2) ShiftStatus
- `generated`: Ca được sinh tự động.
- `confirmed`: Ca đã xác nhận.
- `change_requested`: Ca có yêu cầu điều chỉnh.
- `adjusted`: Ca đã điều chỉnh.
- `finalized`: Ca chính thức.
- `cancelled`: Ca đã hủy.
- `vacant_by_leave`: Ca trống do bác sĩ nghỉ.
- `cancelled_by_doctor_leave`: Ca hủy do bác sĩ nghỉ và có ảnh hưởng lịch hẹn.

## 3) Booking visibility rule
Bác sĩ được hiển thị trên booking khi và chỉ khi:
- `ShiftStatus = finalized`
- `WeekStatus = slot_opened`
- `isArchived = false`
- Có ít nhất 1 slot còn có thể đặt.

## 4) Booking debug reason codes
- `NO_DOCTOR_IN_SPECIALTY`
- `NO_SHIFT_ON_DATE`
- `SHIFT_ARCHIVED`
- `SHIFT_NOT_FINALIZED`
- `WEEK_NOT_SLOT_OPENED`
- `NO_BOOKABLE_SLOT`
- `DOCTOR_DELETED`

## 5) Guard và tương thích
- Backend dùng nguồn trạng thái chung tại `src/module/schedules/schedule-status.ts`.
- Frontend map label tiếng Việt tại `src/lib/scheduleWorkflowDisplay.ts` và `src/lib/bookingAvailabilityDisplay.ts`.
- Nếu thêm status/reason mới mà chưa map đủ, build TypeScript sẽ fail nhờ các `Record<Union, ...>` guard.
- Vận hành có thể kiểm tra tuần bằng script `npm run ops:check-week-readiness`.
