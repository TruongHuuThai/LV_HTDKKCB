/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

function readFile(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function parseContractVersion(content, fileLabel) {
  const m = content.match(/SCHEDULE_STATUS_CONTRACT_VERSION\s*=\s*'([^']+)'/);
  if (!m) {
    throw new Error(`Cannot parse SCHEDULE_STATUS_CONTRACT_VERSION in ${fileLabel}`);
  }
  return m[1];
}

function parseObjectKeys(content, objectName, fileLabel) {
  const objectRegex = new RegExp(`${objectName}\\s*=\\s*\\{([\\s\\S]*?)\\}\\s*as const`);
  const objectMatch = content.match(objectRegex);
  if (!objectMatch) {
    throw new Error(`Cannot parse ${objectName} in ${fileLabel}`);
  }

  const block = objectMatch[1];
  const keys = [];
  const keyRegex = /\n\s*([A-Za-z_][A-Za-z0-9_]*)\s*:/g;
  let match = keyRegex.exec(block);
  while (match) {
    keys.push(match[1]);
    match = keyRegex.exec(block);
  }
  return keys;
}

function ensureSameSet(label, left, right) {
  const l = [...new Set(left)].sort();
  const r = [...new Set(right)].sort();
  const same = l.length === r.length && l.every((v, i) => v === r[i]);
  if (!same) {
    throw new Error(
      `${label} mismatch.\nbackend=${JSON.stringify(l)}\nfrontend=${JSON.stringify(r)}`,
    );
  }
}

function main() {
  const backendContractPath = path.resolve(__dirname, '../backend/src/module/schedules/schedule-status.ts');
  const backendReasonPath = path.resolve(
    __dirname,
    '../backend/src/module/booking/booking-availability.contract.ts',
  );
  const frontendContractPath = path.resolve(__dirname, '../frontend/src/contracts/scheduleStatusContract.ts');

  const backendContract = readFile(backendContractPath);
  const backendReason = readFile(backendReasonPath);
  const frontendContract = readFile(frontendContractPath);

  const backendVersion = parseContractVersion(backendContract, backendContractPath);
  const frontendVersion = parseContractVersion(frontendContract, frontendContractPath);
  if (backendVersion !== frontendVersion) {
    throw new Error(
      `Contract version mismatch. backend=${backendVersion}, frontend=${frontendVersion}`,
    );
  }

  const backendWeekStatuses = parseObjectKeys(backendContract, 'WEEK_STATUS', backendContractPath);
  const frontendWeekStatuses = parseObjectKeys(frontendContract, 'WEEK_STATUS', frontendContractPath);
  ensureSameSet('WEEK_STATUS', backendWeekStatuses, frontendWeekStatuses);

  const backendShiftStatuses = parseObjectKeys(backendContract, 'SHIFT_STATUS', backendContractPath);
  const frontendShiftStatuses = parseObjectKeys(frontendContract, 'SHIFT_STATUS', frontendContractPath);
  ensureSameSet('SHIFT_STATUS', backendShiftStatuses, frontendShiftStatuses);

  const backendReasons = parseObjectKeys(
    backendReason,
    'BOOKING_AVAILABILITY_REASON',
    backendReasonPath,
  );
  const frontendReasons = parseObjectKeys(
    frontendContract,
    'BOOKING_AVAILABILITY_REASON',
    frontendContractPath,
  );
  ensureSameSet('BOOKING_AVAILABILITY_REASON', backendReasons, frontendReasons);

  console.log('Schedule status contract sync check passed.');
  console.log(`Version: ${backendVersion}`);
}

try {
  main();
} catch (error) {
  console.error(String(error?.message || error));
  process.exitCode = 1;
}
