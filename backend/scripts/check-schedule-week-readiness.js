/* eslint-disable no-console */
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

function loadEnvFromFile(envPath) {
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  lines.forEach((line) => {
    const normalized = line.trim();
    if (!normalized || normalized.startsWith('#')) return;
    const idx = normalized.indexOf('=');
    if (idx <= 0) return;
    const key = normalized.slice(0, idx).trim();
    const value = normalized.slice(idx + 1).trim();
    if (!process.env[key]) {
      process.env[key] = value;
    }
  });
}

loadEnvFromFile(path.join(__dirname, '..', '.env'));
loadEnvFromFile(path.join(__dirname, '..', '.env.local'));

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is not defined');
}
const pool = new Pool({ connectionString });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

function parseObjectKeysFromTs(filePath, objectName) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const objectRegex = new RegExp(`${objectName}\\s*=\\s*\\{([\\s\\S]*?)\\}\\s*as const`);
    const objectMatch = content.match(objectRegex);
    if (!objectMatch) return [];
    const block = objectMatch[1];
    const keys = [];
    const keyRegex = /\n\s*([A-Za-z_][A-Za-z0-9_]*)\s*:/g;
    let match = keyRegex.exec(block);
    while (match) {
      keys.push(match[1]);
      match = keyRegex.exec(block);
    }
    return keys;
  } catch {
    return [];
  }
}

function toDateOnlyIso(date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseDateOnly(raw) {
  if (!raw) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw.trim());
  if (!m) return null;
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

function weekMonday(date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d;
}

function addWeeks(date, n) {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + n * 7);
  return d;
}

async function main() {
  const args = process.argv.slice(2);
  const fromArg = args.find((arg) => arg.startsWith('--from='))?.split('=')[1];
  const toArg = args.find((arg) => arg.startsWith('--to='))?.split('=')[1];
  const weeksArg = Number(args.find((arg) => arg.startsWith('--weeks='))?.split('=')[1] || 8);
  const specialtyArgRaw = args.find((arg) => arg.startsWith('--specialtyId='))?.split('=')[1];
  const specialtyId = specialtyArgRaw ? Number(specialtyArgRaw) : null;
  const outputJson = args.includes('--json');
  const failOnNotReady = args.includes('--fail-on-not-ready');

  const today = new Date();
  const fromDate = parseDateOnly(fromArg) || weekMonday(today);
  const toDate =
    parseDateOnly(toArg) || addWeeks(fromDate, Number.isFinite(weeksArg) ? weeksArg : 8);

  const weekBatches = await prisma.dOT_LICH_TUAN.findMany({
    where: {
      DLT_TUAN_BAT_DAU: {
        gte: fromDate,
        lte: toDate,
      },
    },
    orderBy: { DLT_TUAN_BAT_DAU: 'asc' },
    select: {
      DLT_TUAN_BAT_DAU: true,
      DLT_TUAN_KET_THUC: true,
      DLT_TRANG_THAI: true,
      DLT_CHOT_LUC: true,
      DLT_MO_SLOT_LUC: true,
    },
  });

  if (weekBatches.length === 0) {
    console.log('No week batches found in range.');
    return;
  }

  const scheduleStatusPath = path.join(
    __dirname,
    '..',
    'src',
    'module',
    'schedules',
    'schedule-status.ts',
  );
  const knownWeekStatuses = new Set(
    parseObjectKeysFromTs(scheduleStatusPath, 'WEEK_STATUS').length > 0
      ? parseObjectKeysFromTs(scheduleStatusPath, 'WEEK_STATUS')
      : ['generated', 'finalized', 'slot_opened', 'closed'],
  );
  const knownShiftStatuses = new Set(
    parseObjectKeysFromTs(scheduleStatusPath, 'SHIFT_STATUS').length > 0
      ? parseObjectKeysFromTs(scheduleStatusPath, 'SHIFT_STATUS')
      : [
          'generated',
          'confirmed',
          'change_requested',
          'adjusted',
          'finalized',
          'cancelled',
          'vacant_by_leave',
          'cancelled_by_doctor_leave',
        ],
  );

  const weekStartDates = weekBatches.map((item) => item.DLT_TUAN_BAT_DAU);
  const shifts = await prisma.lICH_BSK.findMany({
    where: {
      DLT_TUAN_BAT_DAU: { in: weekStartDates },
      ...(Number.isFinite(specialtyId) && specialtyId != null
        ? { BAC_SI: { CK_MA: specialtyId } }
        : {}),
    },
    select: {
      DLT_TUAN_BAT_DAU: true,
      LBSK_TRANG_THAI: true,
      LBSK_IS_ARCHIVED: true,
    },
  });

  const unknownWeekStatuses = Array.from(
    new Set(
      weekBatches
        .map((item) => String(item.DLT_TRANG_THAI || '').toLowerCase())
        .filter((status) => status && !knownWeekStatuses.has(status)),
    ),
  );
  const unknownShiftStatuses = Array.from(
    new Set(
      shifts
        .map((item) => String(item.LBSK_TRANG_THAI || '').toLowerCase())
        .filter((status) => status && !knownShiftStatuses.has(status)),
    ),
  );

  const byWeek = new Map();
  shifts.forEach((shift) => {
    const key = toDateOnlyIso(shift.DLT_TUAN_BAT_DAU);
    const current =
      byWeek.get(key) ||
      {
        total: 0,
        archived: 0,
        active: 0,
        finalizedActive: 0,
      };
    current.total += 1;
    if (shift.LBSK_IS_ARCHIVED) current.archived += 1;
    else current.active += 1;
    if (!shift.LBSK_IS_ARCHIVED && String(shift.LBSK_TRANG_THAI).toLowerCase() === 'finalized') {
      current.finalizedActive += 1;
    }
    byWeek.set(key, current);
  });

  let readyCount = 0;
  let notReadyCount = 0;
  const weekRows = [];
  if (!outputJson) {
    console.log('=== SCHEDULE WEEK READINESS ===');
    console.log(`Range: ${toDateOnlyIso(fromDate)} -> ${toDateOnlyIso(toDate)}`);
    if (Number.isFinite(specialtyId) && specialtyId != null) {
      console.log(`Specialty: ${specialtyId}`);
    }
  }

  weekBatches.forEach((week) => {
    const key = toDateOnlyIso(week.DLT_TUAN_BAT_DAU);
    const stats = byWeek.get(key) || { total: 0, archived: 0, active: 0, finalizedActive: 0 };
    const weekStatus = String(week.DLT_TRANG_THAI || '').toLowerCase();

    const issues = [];
    if (weekStatus !== 'finalized' && weekStatus !== 'slot_opened') {
      issues.push('NOT_FINALIZED');
    }
    if (weekStatus !== 'slot_opened') {
      issues.push('NOT_SLOT_OPENED');
    }
    if (stats.finalizedActive <= 0) {
      issues.push('NO_FINALIZED_ACTIVE_SHIFT');
    }
    if (stats.active <= 0 && stats.archived > 0) {
      issues.push('ONLY_ARCHIVED_SHIFTS');
    }

    const ready = issues.length === 0;
    if (ready) readyCount += 1;
    else notReadyCount += 1;

    weekRows.push({
      weekStart: key,
      weekStatus,
      ready,
      issues,
      stats,
    });

    if (!outputJson) {
      console.log('');
      console.log(
        `[${ready ? 'READY' : 'NOT_READY'}] week=${key} status=${weekStatus} shifts(total=${stats.total}, active=${stats.active}, archived=${stats.archived}, finalizedActive=${stats.finalizedActive})`,
      );
      if (!ready) {
        console.log(`  missing=${issues.join(', ')}`);
      }
    }
  });

  const summary = {
    range: {
      from: toDateOnlyIso(fromDate),
      to: toDateOnlyIso(toDate),
    },
    specialtyId: Number.isFinite(specialtyId) ? specialtyId : null,
    readyWeeks: readyCount,
    notReadyWeeks: notReadyCount,
    unknownWeekStatuses,
    unknownShiftStatuses,
  };

  if (outputJson) {
    console.log(JSON.stringify({ summary, weeks: weekRows }, null, 2));
  } else {
    console.log('');
    console.log('=== SUMMARY ===');
    console.log(`readyWeeks=${readyCount}`);
    console.log(`notReadyWeeks=${notReadyCount}`);
    if (unknownWeekStatuses.length > 0) {
      console.log(`unknownWeekStatuses=${unknownWeekStatuses.join(',')}`);
    }
    if (unknownShiftStatuses.length > 0) {
      console.log(`unknownShiftStatuses=${unknownShiftStatuses.join(',')}`);
    }
  }

  if (failOnNotReady && (notReadyCount > 0 || unknownWeekStatuses.length > 0 || unknownShiftStatuses.length > 0)) {
    process.exitCode = 2;
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
