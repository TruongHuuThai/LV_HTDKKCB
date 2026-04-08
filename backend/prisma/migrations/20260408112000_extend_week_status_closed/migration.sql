ALTER TABLE "DOT_LICH_TUAN" DROP CONSTRAINT IF EXISTS "ck_dlt_trang_thai";

ALTER TABLE "DOT_LICH_TUAN"
ADD CONSTRAINT "ck_dlt_trang_thai"
CHECK ("DLT_TRANG_THAI" IN ('generated', 'finalized', 'slot_opened', 'closed'));
