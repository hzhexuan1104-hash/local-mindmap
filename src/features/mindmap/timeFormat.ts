const UNKNOWN_TIME_LABEL = '时间未知';

function parseValidDate(value: string | null | undefined) {
  if (!value || typeof value !== 'string') {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function pad(value: number) {
  return String(value).padStart(2, '0');
}

function formatLocalClock(date: Date) {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function localDayStart(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/** Formats persisted UTC ISO timestamps for local, user-facing UI only. */
export function formatLocalDateTime(value: string | null | undefined) {
  const date = parseValidDate(value);
  if (!date) {
    return UNKNOWN_TIME_LABEL;
  }

  return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${formatLocalClock(date)}`;
}

export function formatRelativeLocalTime(
  value: string | null | undefined,
  now = new Date(),
) {
  const date = parseValidDate(value);
  if (!date || Number.isNaN(now.getTime())) {
    return UNKNOWN_TIME_LABEL;
  }

  const dayDifference = Math.round((localDayStart(now) - localDayStart(date)) / 86_400_000);
  if (dayDifference === 0) {
    return `今天 ${formatLocalClock(date)}`;
  }
  if (dayDifference === 1) {
    return `昨天 ${formatLocalClock(date)}`;
  }

  return formatLocalDateTime(value);
}

/** Keeps persisted ISO values as the source of truth for chronological ordering. */
export function compareIsoDateTimesDesc(left: string, right: string) {
  const leftTimestamp = parseValidDate(left)?.getTime();
  const rightTimestamp = parseValidDate(right)?.getTime();

  if (leftTimestamp === undefined && rightTimestamp === undefined) {
    return 0;
  }
  if (leftTimestamp === undefined) {
    return 1;
  }
  if (rightTimestamp === undefined) {
    return -1;
  }
  return rightTimestamp - leftTimestamp;
}
