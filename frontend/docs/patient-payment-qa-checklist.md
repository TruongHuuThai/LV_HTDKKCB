# QA Checklist - Patient Booking & Payment Flow

## 1) Booking create
- Login as `BENH_NHAN`
- Open `/booking`
- Select patient profile
- Select doctor/date/slot
- Fill symptoms + note
- Submit and verify booking is created

## 2) Payment redirect
- After booking, confirm redirect to VNPAY/payment gateway
- Confirm loading state appears and no double-submit occurs

## 3) Payment result
- Return to `/payment-result`
- Verify page re-checks backend status
- Cases:
  - paid
  - failed
  - expired
  - pending

## 4) Retry payment
- From `/payment-result` and `/appointments/my`, retry payment for failed/expired/unpaid
- Confirm new payment URL opens and status updates after return

## 5) My appointments
- Open `/appointments/my`
- Validate filters: upcoming/completed/canceled/no_show
- Validate pagination and keyword search
- Validate quick actions visibility by policy

## 6) Appointment detail
- Open `/appointments/:id`
- Verify payment status, cancel policy, timeline, pre-visit info
- Validate actions:
  - cancel
  - reschedule
  - retry payment

## 7) Auth and permission
- Ensure non-patient users cannot access patient-only routes
- Ensure invalid appointment id shows safe error state

## 8) Responsive
- Verify `/booking`, `/payment-result`, `/appointments/my`, `/appointments/:id` on mobile width
