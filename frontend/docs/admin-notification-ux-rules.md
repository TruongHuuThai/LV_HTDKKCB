# Admin Notification UX Rules

## Luồng thao tác chuẩn
1. Chọn loại thông báo
2. Chọn nhóm đối tượng nhận
3. Chọn điều kiện lọc (nếu cần)
4. Xem trước người nhận
5. Soạn nội dung
6. Xác nhận và gửi

## Quy tắc hiển thị theo Target Group
- `ALL_USERS`
  - Không bắt buộc filter
  - Hiển thị cảnh báo gửi diện rộng
- `PATIENTS`
  - Có thể gửi toàn bộ bệnh nhân
  - Có thể lọc theo ngày/lịch hẹn
- `DOCTORS`
  - Có thể gửi toàn bộ bác sĩ
  - Có thể lọc thêm chuyên khoa/bác sĩ
- `BY_SPECIALTY`
  - Bắt buộc chọn ít nhất một chuyên khoa
- `ADVANCED_FILTER`
  - Hiển thị chọn phạm vi nâng cao (`PATIENTS`/`DOCTORS`/`ALL_USERS`)
  - Bắt buộc có ít nhất một điều kiện meaningful

## Quy tắc cảnh báo
- Hiển thị warning khi:
  - Gửi `ALL_USERS`
  - Gửi diện rộng không có filter meaningful cho `PATIENTS`/`DOCTORS`
  - Số lượng người nhận lớn

## Quy tắc Preview
- Preview phải dùng cùng payload và logic resolver với Send.
- Không hiển thị số giả.
- Nếu không có người nhận:
  - Hiển thị `emptyReason` từ backend.

## Quy tắc nội dung UI
- Dùng nhãn tiếng Việt thân thiện.
- Tránh lộ field kỹ thuật ở phần chính; kỹ thuật đưa vào phần nâng cao.
- Ký hiệu bắt buộc bằng dấu `*` màu đỏ.

