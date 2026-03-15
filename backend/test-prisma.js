const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
    const props = Object.keys(prisma).filter(k => {
        return prisma[k] && typeof prisma[k] === 'object' && typeof prisma[k].findMany === 'function';
    });
    console.log("PRISMA MODEL PROPERTIES WITH FINDMANY:", props);
}

test().finally(() => prisma.$disconnect());
