const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
    console.log("Starting test...");
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Start of today
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1); // Start of tomorrow

    const thirtyDaysFromNow = new Date(today);
    thirtyDaysFromNow.setDate(today.getDate() + 30);

    console.log("Testing Daily Config...");
    try {
        await prisma.dANG_KY.count({ where: { N_NGAY: { gte: today, lt: tomorrow } }});
        console.log("Daily operations 1 OK");
        
        await prisma.tHANH_TOAN.aggregate({
        _sum: { TT_TONG_TIEN: true },
        where: { TT_THOI_GIAN: { gte: today, lt: tomorrow }, TT_TRANG_THAI: 'DA_THANH_TOAN' },
        });
        console.log("Financials OK");
        
        await prisma.lICH_BSK.findMany({
            where: { N_NGAY: { gte: today, lt: tomorrow } },
            distinct: ['BS_MA'],
            select: { BS_MA: true }
        });
        console.log("Doctors on duty OK");
        
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        await prisma.dANG_KY.groupBy({
            by: ['BS_MA'],
            where: { N_NGAY: { gte: startOfMonth }, DK_TRANG_THAI: 'DA_KHAM' },
            _count: { BS_MA: true },
            orderBy: { _count: { BS_MA: 'desc' } },
            take: 5,
        });
        console.log("Top Doctors Group By OK");

        await prisma.tHUOC.findMany({
            where: { T_HAN_SU_DUNG: { gte: today, lte: thirtyDaysFromNow }, T_DA_XOA: false },
            select: { T_MA: true, T_TEN_THUOC: true, T_HAN_SU_DUNG: true },
            orderBy: { T_HAN_SU_DUNG: 'asc' },
            take: 10,
        });
        console.log("Expiring medicines OK");
        
    } catch (e) {
        console.error("PRISMA ERROR:", e);
    }
}

test().finally(() => prisma.$disconnect());
