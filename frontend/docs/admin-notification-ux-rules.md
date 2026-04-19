# Admin Notification UX Rules

## Luồng thao tác chuẩn
1. Chọn loại thông báo.
2. Chọn nhóm đối tượng nhận.
3. Chọn điều kiện lọc (nếu cần).
4. Xem trước người nhận.
5. Soạn nội dung.
6. Xác nhận và gửi.

## Quy tắc hiển thị theo target group
- `ALL_USERS`
- Không bắt buộc filter.
- Bắt buộc hiển thị cảnh báo gửi diện rộng.
- `PATIENTS`
- Cho phép gửi toàn bộ bệnh nhân.
- Có thể lọc theo ngày, khoảng ngày, mã lịch hẹn.
- `DOCTORS`
- Cho phép gửi toàn bộ bác sĩ.
- Có thể lọc thêm theo chuyên khoa, bác sĩ cụ thể.
- `BY_SPECIALTY`
- Bắt buộc chọn ít nhất một chuyên khoa.
- `ADVANCED_FILTER`
- Hiển thị đầy đủ filter nâng cao.
- Bắt buộc có ít nhất một điều kiện lọc meaningful.

## Quy tắc quick presets
- Hỗ trợ các preset:
- `all_patients`
- `all_doctors`
- `all_users`
- `patients_today`
- `patients_tomorrow`
- Preset chỉ là gợi ý đầu vào; preview/send luôn chạy theo payload cuối cùng.

## Quy tắc cảnh báo
- Hiển thị warning khi:
- Gửi `ALL_USERS`.
- Gửi diện rộng cho `PATIENTS` hoặc `DOCTORS` mà không có filter meaningful.
- Số người nhận lớn (backend quyết định ngưỡng cảnh báo).

## Quy tắc preview
- Preview phải dùng cùng payload và cùng recipient resolver với send.
- Không hiển thị số giả.
- Nếu không có người nhận thì hiển thị `emptyReason` từ backend.
- Ưu tiên hiển thị `summaryText` để admin hiểu phạm vi gửi bằng ngôn ngữ tự nhiên.

## Quy tắc nội dung UI
- Dùng nhãn tiếng Việt có dấu, UTF-8.
- Tránh lộ field kỹ thuật ở phần mặc định; field kỹ thuật chỉ hiện trong phần nâng cao.
- Ký hiệu bắt buộc bằng dấu `*` màu đỏ.
