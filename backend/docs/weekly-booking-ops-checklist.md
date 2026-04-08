# Checklist vận hành tuần mới (booking)

## Mục tiêu
Đảm bảo tuần đủ điều kiện để bệnh nhân thấy bác sĩ và đặt lịch.

## Quy trình chuẩn
1. `Generate`: sinh dữ liệu lịch tuần.
2. `Finalize`: chốt tuần và chốt ca hợp lệ.
3. `Open slot`: mở slot booking cho tuần.

## Checklist thực thi
1. Chạy script kiểm tra:
`npm run ops:check-week-readiness -- --weeks=8`

2. Nếu cần kiểm tra theo chuyên khoa và xuất JSON:
`npm run ops:check-week-readiness -- --weeks=8 --specialtyId=21 --json`

3. Xác nhận tuần mục tiêu có:
- `DLT_TRANG_THAI = slot_opened`
- Có ca `LBSK_TRANG_THAI = finalized`
- Không rơi vào trạng thái chỉ còn ca archived.

4. Kiểm tra nhanh API booking:
- `GET /booking/doctors?date=YYYY-MM-DD`
- `GET /booking/debug-availability?date=YYYY-MM-DD`

5. Nếu API booking trả rỗng, đọc `summary.reasons` từ debug endpoint và xử lý theo nguyên nhân.

## Các lỗi vận hành thường gặp
1. `NOT_FINALIZED`: chưa chốt tuần hoặc ca.
2. `NOT_SLOT_OPENED`: chưa mở slot booking.
3. `ONLY_ARCHIVED_SHIFTS`: tuần chỉ còn dữ liệu archived.
4. `NO_FINALIZED_ACTIVE_SHIFT`: chưa có ca finalized còn active.
5. `unknownWeekStatuses` / `unknownShiftStatuses`: dữ liệu có status ngoài contract, cần audit ngay.

## Gợi ý chạy trong CI/cron
- Dùng cờ fail sớm khi có tuần chưa sẵn sàng:
`npm run ops:check-week-readiness -- --weeks=8 --fail-on-not-ready`
