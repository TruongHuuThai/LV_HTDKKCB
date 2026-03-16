export type ScheduleWorkflowStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'official';

const STATUS_MARKER_PREFIX = '[#SCHEDULE_STATUS:';
const STATUS_MARKER_SUFFIX = ']';

const STATUS_SET: ReadonlySet<ScheduleWorkflowStatus> = new Set([
  'pending',
  'approved',
  'rejected',
  'official',
]);

export function parseScheduleStatus(
  rawNote?: string | null,
): { status: ScheduleWorkflowStatus; note: string | null } {
  if (!rawNote) {
    return { status: 'official', note: null };
  }

  if (
    rawNote.startsWith(STATUS_MARKER_PREFIX) &&
    rawNote.includes(STATUS_MARKER_SUFFIX)
  ) {
    const markerEndIndex = rawNote.indexOf(STATUS_MARKER_SUFFIX);
    const marker = rawNote.slice(STATUS_MARKER_PREFIX.length, markerEndIndex);
    const normalizedMarker = marker.trim().toLowerCase() as ScheduleWorkflowStatus;
    if (STATUS_SET.has(normalizedMarker)) {
      const extra = rawNote.slice(markerEndIndex + 1).trim();
      return {
        status: normalizedMarker,
        note: extra.length > 0 ? extra : null,
      };
    }
  }

  return { status: 'official', note: rawNote.trim() || null };
}

export function buildScheduleNote(
  status: ScheduleWorkflowStatus,
  note?: string | null,
) {
  const normalizedStatus = STATUS_SET.has(status) ? status : 'official';
  const normalizedNote = note?.trim() || '';
  const marker = `${STATUS_MARKER_PREFIX}${normalizedStatus}${STATUS_MARKER_SUFFIX}`;
  return normalizedNote.length > 0 ? `${marker}\n${normalizedNote}` : marker;
}

export function isScheduleVisibleForBooking(rawNote?: string | null) {
  const { status } = parseScheduleStatus(rawNote);
  return status === 'official' || status === 'approved';
}

