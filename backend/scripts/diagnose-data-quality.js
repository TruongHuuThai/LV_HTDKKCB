/* eslint-disable no-console */
const { PrismaClient } = require('@prisma/client');

async function run() {
  const prisma = new PrismaClient();
  try {
    const [
      duplicateWaitlist,
      orphanAttachments,
      conflictingAppointmentStatus,
      paymentMismatch,
    ] = await Promise.all([
      prisma.$queryRawUnsafe(`
        SELECT "BN_MA","BS_MA","N_NGAY","B_TEN","KG_MA", COUNT(*)::int AS total
        FROM "WAITLIST_ENTRY"
        WHERE "WL_STATUS" IN ('WAITING','NOTIFIED','HOLDING')
        GROUP BY "BN_MA","BS_MA","N_NGAY","B_TEN","KG_MA"
        HAVING COUNT(*) > 1
      `),
      prisma.$queryRawUnsafe(`
        SELECT pva."PVA_MA", pva."DK_MA"
        FROM "PRE_VISIT_ATTACHMENT" pva
        LEFT JOIN "DANG_KY" dk ON dk."DK_MA" = pva."DK_MA"
        WHERE dk."DK_MA" IS NULL
      `),
      prisma.$queryRawUnsafe(`
        SELECT dk."DK_MA", dk."DK_TRANG_THAI", tt."TT_TRANG_THAI"
        FROM "DANG_KY" dk
        JOIN "THANH_TOAN" tt ON tt."DK_MA" = dk."DK_MA"
        WHERE dk."DK_TRANG_THAI" = 'DA_KHAM'
          AND tt."TT_LOAI" = 'DAT_LICH'
          AND tt."TT_TRANG_THAI" = 'CHUA_THANH_TOAN'
      `),
      prisma.$queryRawUnsafe(`
        SELECT tt."TT_MA", tt."DK_MA", tt."TT_TRANG_THAI", tt."TT_MA_GIAO_DICH"
        FROM "THANH_TOAN" tt
        WHERE tt."TT_LOAI" = 'DAT_LICH'
          AND tt."TT_TRANG_THAI" = 'DA_THANH_TOAN'
          AND (tt."TT_MA_GIAO_DICH" IS NULL OR tt."TT_MA_GIAO_DICH" = '')
      `),
    ]);

    const report = {
      duplicateWaitlistActive: duplicateWaitlist.length,
      orphanAttachments: orphanAttachments.length,
      completedButUnpaid: conflictingAppointmentStatus.length,
      paidWithoutGatewayTxn: paymentMismatch.length,
    };

    console.log('=== DATA QUALITY DIAGNOSTIC ===');
    console.log(JSON.stringify(report, null, 2));
    if (duplicateWaitlist.length) console.log('duplicateWaitlist samples:', duplicateWaitlist.slice(0, 5));
    if (orphanAttachments.length) console.log('orphanAttachments samples:', orphanAttachments.slice(0, 5));
    if (conflictingAppointmentStatus.length) {
      console.log('completedButUnpaid samples:', conflictingAppointmentStatus.slice(0, 5));
    }
    if (paymentMismatch.length) console.log('paidWithoutGatewayTxn samples:', paymentMismatch.slice(0, 5));
  } finally {
    await prisma.$disconnect();
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});

