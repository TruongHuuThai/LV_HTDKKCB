ALTER TABLE "LICH_BSK"
ADD COLUMN "LBSK_IS_ARCHIVED" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "LBSK_ARCHIVED_AT" TIMESTAMP(6),
ADD COLUMN "LBSK_ARCHIVED_BY" TEXT,
ADD COLUMN "LBSK_ARCHIVE_REASON" TEXT;

ALTER TABLE "LICH_BSK" DROP CONSTRAINT IF EXISTS "ck_lich_bsk_nguon";
ALTER TABLE "LICH_BSK"
ADD CONSTRAINT "ck_lich_bsk_nguon"
CHECK (
  "LBSK_NGUON" IN (
    'legacy_registration',
    'template',
    'admin_manual',
    'auto_rolling',
    'copied_1_month',
    'copied_2_months',
    'copied_3_months'
  )
);

CREATE INDEX "idx_lich_bsk_archived" ON "LICH_BSK"("LBSK_IS_ARCHIVED");
