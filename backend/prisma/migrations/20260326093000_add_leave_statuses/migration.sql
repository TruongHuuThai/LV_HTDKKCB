-- Add leave-related schedule statuses
ALTER TABLE "LICH_BSK" DROP CONSTRAINT IF EXISTS "LICH_BSK_LBSK_TRANG_THAI_check";
ALTER TABLE "LICH_BSK" ADD CONSTRAINT "LICH_BSK_LBSK_TRANG_THAI_check" CHECK ("LBSK_TRANG_THAI" IN ('generated', 'confirmed', 'change_requested', 'adjusted', 'finalized', 'cancelled', 'vacant_by_leave', 'cancelled_by_doctor_leave'));
