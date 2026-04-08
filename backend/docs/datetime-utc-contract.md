# DateTime UTC Contract

Cập nhật: 2026-04-09
Phạm vi: Booking, schedule tuần, slot, debug availability.

## 1) Quy ước bắt buộc
- Mọi giá trị ngày dạng `YYYY-MM-DD` phải được hiểu là ngày UTC.
- Cột ngày nghiệp vụ (`N_NGAY`, `DLT_TUAN_BAT_DAU`, `DLT_TUAN_KET_THUC`) xử lý theo mốc UTC midnight.
- Khi lọc theo ngày, luôn dùng khoảng UTC:
  - `start = Date.UTC(y, m-1, d, 00:00:00)`
  - `end = start + 1 day`
- Không dùng `setHours(0,0,0,0)` theo local timezone để lọc dữ liệu ngày.

## 2) Rule kỹ thuật
- Parse ngày từ client:
  - `parseDateOnly("2026-05-11") => 2026-05-11T00:00:00.000Z`
- Ghép ngày + giờ slot:
  - Dùng helper chuẩn `combineDateAndTime(dateOnlyUtc, slotTime)`.
- Lọc tuần:
  - Tính thứ Hai theo UTC (`getUTCDay`, `setUTCDate`).

## 3) Ví dụ sai thường gặp
- Sai: tạo mốc ngày bằng local timezone rồi query DB UTC.
- Hậu quả: API trả `NO_SHIFT_ON_DATE` dù DB có lịch đúng ngày.

## 4) Checklist nhanh khi debug
1. Kiểm tra request `date` có đúng định dạng `YYYY-MM-DD`.
2. Kiểm tra range query có phải UTC day range không.
3. Kiểm tra `shiftStatus=finalized`, `weekStatus=slot_opened`, `isArchived=false`.
4. Kiểm tra slot có còn bookable (`bookableSlots > 0`, chưa qua giờ).

## 5) Khuyến nghị vận hành
- Khi có lỗi lệch ngày, chạy debug API theo ngày cụ thể trước:
  - `GET /booking/debug-availability?date=YYYY-MM-DD&specialtyId=...`
- Không suy luận từ timezone trình duyệt; luôn đối chiếu theo UTC contract này.
