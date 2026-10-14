/**
 * Date and Time Utilities for Qayd
 */

export const DEFAULT_TIMEZONE = 'Asia/Riyadh';

/**
 * Returns current date in YYYY-MM-DD format based on timezone
 */
export function getTodayDateString(timezone: string = DEFAULT_TIMEZONE): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(new Date());
  } catch {
    const d = new Date();
    return d.toISOString().split('T')[0];
  }
}

/**
 * Returns current time in HH:mm (24h for input value) based on timezone
 */
export function getCurrentTimeString(timezone: string = DEFAULT_TIMEZONE): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    return formatter.format(new Date());
  } catch {
    const d = new Date();
    return d.toTimeString().slice(0, 5);
  }
}

/**
 * Formats 24h time string (e.g. "14:30") into 12-hour format with Arabic AM/PM ("02:30 م" or "09:15 ص")
 */
export function formatTime12Hour(timeStr: string): string {
  if (!timeStr) return '';
  const parts = timeStr.split(':');
  if (parts.length < 2) return timeStr;
  let hours = parseInt(parts[0], 10);
  const minutes = parts[1];
  const ampm = hours >= 12 ? 'م' : 'ص';
  hours = hours % 12;
  hours = hours ? hours : 12;
  const formattedHour = String(hours).padStart(2, '0');
  return `${formattedHour}:${minutes} ${ampm}`;
}

/**
 * Formats YYYY-MM-DD date into friendly Arabic format
 */
export function formatDateArabic(dateStr: string): string {
  try {
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return new Intl.DateTimeFormat('ar-SA', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(date);
  } catch {
    return dateStr;
  }
}

/**
 * Returns yesterday's date string YYYY-MM-DD
 */
export function getYesterdayDateString(timezone: string = DEFAULT_TIMEZONE): string {
  try {
    const todayStr = getTodayDateString(timezone);
    const [year, month, day] = todayStr.split('-').map(Number);
    const d = new Date(year, month - 1, day - 1);
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(d);
  } catch {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
  }
}

/**
 * Get week range (start date and end date) with configurable week start
 * Saturday default
 */
export function getWeekRange(
  dateStr: string,
  weekStart: 'saturday' | 'sunday' | 'monday' = 'saturday'
): { startDate: string; endDate: string; days: string[] } {
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  const dayOfWeek = d.getDay(); // 0 = Sun, 1 = Mon, ..., 5 = Fri, 6 = Sat

  let offset = 0;
  if (weekStart === 'saturday') {
    // Sat = 6 -> offset = 0
    // Sun = 0 -> offset = -1
    // Mon = 1 -> offset = -2
    // Tue = 2 -> offset = -3
    // Wed = 3 -> offset = -4
    // Thu = 4 -> offset = -5
    // Fri = 5 -> offset = -6
    offset = dayOfWeek === 6 ? 0 : -(dayOfWeek + 1);
  } else if (weekStart === 'sunday') {
    offset = -dayOfWeek;
  } else {
    // monday
    offset = dayOfWeek === 0 ? -6 : -(dayOfWeek - 1);
  }

  const startDateObj = new Date(year, month - 1, day + offset);
  const days: string[] = [];
  for (let i = 0; i < 7; i++) {
    const curr = new Date(startDateObj);
    curr.setDate(startDateObj.getDate() + i);
    const yStr = curr.getFullYear();
    const mStr = String(curr.getMonth() + 1).padStart(2, '0');
    const dStr = String(curr.getDate()).padStart(2, '0');
    days.push(`${yStr}-${mStr}-${dStr}`);
  }

  return {
    startDate: days[0],
    endDate: days[6],
    days,
  };
}

/**
 * Get days array for week strip around a center date
 */
export function getSurroundingWeekDays(dateStr: string, count: number = 7): { dateStr: string; dayNum: number; dayName: string }[] {
  const [year, month, day] = dateStr.split('-').map(Number);
  const centerDate = new Date(year, month - 1, day);
  const half = Math.floor(count / 2);
  const result: { dateStr: string; dayNum: number; dayName: string }[] = [];

  for (let i = -half; i <= half; i++) {
    const cur = new Date(centerDate);
    cur.setDate(centerDate.getDate() + i);
    const y = cur.getFullYear();
    const m = String(cur.getMonth() + 1).padStart(2, '0');
    const d = String(cur.getDate()).padStart(2, '0');
    const str = `${y}-${m}-${d}`;
    const dayName = new Intl.DateTimeFormat('ar-SA', { weekday: 'short' }).format(cur);
    result.push({
      dateStr: str,
      dayNum: cur.getDate(),
      dayName,
    });
  }

  return result;
}
