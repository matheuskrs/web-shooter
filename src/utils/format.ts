/** 125 -> "02:05" */
export function formatClock(totalSeconds: number): string {
  const safe = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

/** "08 SEP" / "19:36" in local time, the compact log format of the ranking and history tables. */
export function formatLogDate(iso: string): { date: string; time: string } {
  const value = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    date: `${pad(value.getDate())} ${MONTHS[value.getMonth()] ?? ''}`,
    time: `${pad(value.getHours())}:${pad(value.getMinutes())}`,
  };
}
