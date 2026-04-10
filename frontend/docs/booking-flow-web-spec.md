# Đặc tả luồng đặt khám web mới

## 1. Mục tiêu
- Thiết kế lại luồng đặt khám web theo hướng trực quan, ít nhầm lẫn, dễ triển khai.
- Hỗ trợ 3 điểm bắt đầu: theo ngày, theo chuyên khoa, theo bác sĩ.
- Dù bắt đầu theo cách nào vẫn hội tụ vào pipeline chuẩn: hồ sơ -> thông tin khám -> bảo hiểm bắt buộc -> review -> thanh toán -> kết quả.

## 2. Luồng tổng thể
1. Vào chức năng đặt khám.
2. Chọn cách bắt đầu (A/B/C).
3. Chọn hồ sơ bệnh nhân (hoặc tạo mới).
4. Hoàn tất thông tin khám hợp lệ.
5. Chọn bảo hiểm bắt buộc (BHYT + tư nhân, Có/Không bắt buộc).
6. Xem lại thông tin đặt khám.
7. Chọn phương thức thanh toán.
8. Hiển thị QR/payment info + countdown.
9. Nhận trạng thái thanh toán.
10. Xác nhận lịch hẹn và điều hướng sang chi tiết lịch hẹn.

## 3. User flow theo nhánh
### 3.1 Nhánh A: Theo ngày khám trước
- Hồ sơ -> Ngày -> Chuyên khoa -> Bác sĩ/khung giờ -> Bảo hiểm -> Review -> Thanh toán -> Kết quả.

### 3.2 Nhánh B: Theo chuyên khoa trước
- Hồ sơ -> Chuyên khoa -> Ngày -> Bác sĩ/khung giờ -> Bảo hiểm -> Review -> Thanh toán -> Kết quả.

### 3.3 Nhánh C: Theo bác sĩ trước
- Hồ sơ -> Bác sĩ -> lọc chuyên khoa/ngày/slot hợp lệ.
- Nếu bác sĩ có 1 chuyên khoa: auto chọn.
- Nếu nhiều chuyên khoa: bắt buộc chọn chuyên khoa.
- Tiếp tục Ngày -> Slot -> Bảo hiểm -> Review -> Thanh toán -> Kết quả.

## 4. Screen list
1. Chọn cách đặt lịch.
2. Chọn hồ sơ bệnh nhân.
3. Tạo/sửa hồ sơ.
4. Chọn ngày khám.
5. Chọn chuyên khoa.
6. Chọn bác sĩ.
7. Chọn khung giờ.
8. Chọn bảo hiểm.
9. Chọn công ty bảo hiểm tư nhân.
10. Review thông tin đặt khám.
11. Chọn phương thức thanh toán.
12. Màn QR/payment info.
13. Màn kết quả thanh toán/đặt lịch.
14. Màn lịch hẹn chi tiết.
15. Màn resume draft dở dang.

## 5. Mapping dữ liệu bắt buộc
Mỗi draft phải xác định rõ:
- `patientProfileId`
- `appointmentDate`
- `departmentId`
- `doctorId`
- `roomId`
- `slotId`
- `consultationFee`
- `insurance.hasBHYT`, `insurance.bhytTypeId`
- `insurance.hasPrivateInsurance`, `insurance.privateInsurerId`
- `paymentMethod`, `paymentIntentId`, `paymentStatus`
- `bookingHoldId`, `bookingStatus`

## 6. Reset rules giữa các bước phụ thuộc
- Đổi hồ sơ: reset toàn bộ downstream.
- Đổi ngày: reset bác sĩ/phòng/slot.
- Đổi chuyên khoa: reset bác sĩ/phòng/slot.
- Đổi bác sĩ: reset slot, có thể reset chuyên khoa nếu không còn hợp lệ.
- Đổi bảo hiểm: giữ selection khám nhưng bắt buộc validate lại review.
- Đổi payment method: reset payment intent, không reset booking hold.

## 7. State management
- Nguồn chuẩn: backend `booking draft` có `draftVersion`.
- Frontend giữ state tạm bằng `bookingFlowMachine`.
- Persist session bằng `sessionStorage` để xử lý refresh/tab close.
- Resume flow bằng API `GET /v1/booking-drafts/resume`.
- Multi-tab: optimistic locking qua `draftVersion`.

## 8. Payment flow và post-payment
1. Validate draft.
2. Hold slot có TTL.
3. Tạo payment intent.
4. Hiển thị QR/payment URL.
5. Poll trạng thái payment + nhận webhook backend.
6. Payment thành công -> confirm booking.
7. Nếu callback chậm -> trạng thái `PENDING_CONFIRMATION`.

## 9. Edge cases bắt buộc
- Chưa có hồ sơ.
- Hồ sơ thiếu thông tin.
- Không có ngày khả dụng.
- Chuyên khoa hết bác sĩ.
- Bác sĩ hết slot.
- Slot tranh chấp.
- Bảo hiểm Có nhưng thiếu loại/công ty.
- Giá thay đổi trước thanh toán.
- QR hết hạn.
- Payment thất bại.
- Payment pending kéo dài.
- Callback chậm.
- Người dùng back nhiều lần.
- Multi-tab conflict.

## 10. Bố cục UX web + responsive
### Desktop
- Left panel: step navigation/progress.
- Main panel: nội dung bước hiện tại.
- Right panel sticky summary: hồ sơ, chuyên khoa, bác sĩ, ngày, giờ, giá, bảo hiểm.

### Tablet
- Stepper ngang + summary dạng collapsible.

### Mobile
- Stepper rút gọn.
- CTA sticky bottom.
- Summary compact ngay trên CTA.

## 11. Component list
- `BookingModeSelector`
- `StepProgress`
- `PatientProfileList`
- `AvailabilityCalendar`
- `DepartmentSearchList`
- `DoctorSlotAccordion`
- `InsuranceRequiredBlock`
- `PrivateInsurerPicker`
- `BookingSummarySticky`
- `PaymentMethodList`
- `PaymentQRCodePanel`
- `PaymentCountdownTimer`
- `DraftResumeModal`
- `FlowErrorBanner`

## 12. Test cases trọng yếu
- E2E thành công cho cả 3 nhánh A/B/C.
- Validate bảo hiểm bắt buộc.
- Reset phụ thuộc đúng khi đổi bước trước.
- Slot conflict.
- Price changed.
- Payment failed/expired/pending.
- Callback chậm.
- Resume sau refresh/tab close.
- Multi-tab conflict.
- Responsive + accessibility.

## 13. Tài liệu liên quan trong repo
- OpenAPI contract: `backend/docs/booking-flow.openapi.yaml`
- State machine: `frontend/src/lib/bookingFlowMachine.ts`
