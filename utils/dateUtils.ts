/**
 * Utility functions for handling dates and timezones.
 * The application operates in Colombia, so we need to ensure
 * that "today" is calculated based on the America/Bogota timezone,
 * not UTC, to prevent services from disappearing after 7 PM local time (00:00 UTC).
 */

export const getColombiaDateString = (dateObj: Date = new Date()): string => {
  // Convert the given date to Colombia time
  const dateStr = dateObj.toLocaleString("en-US", { timeZone: "America/Bogota" });
  const colDate = new Date(dateStr);
  
  const year = colDate.getFullYear();
  const month = String(colDate.getMonth() + 1).padStart(2, '0');
  const day = String(colDate.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
};

export const isSameColombiaDay = (isoString: string, colombiaDateStr: string): boolean => {
  if (!isoString) return false;
  const dateObj = new Date(isoString);
  return getColombiaDateString(dateObj) === colombiaDateStr;
};

export const isBeforeColombiaDay = (isoString: string, colombiaDateStr: string): boolean => {
  if (!isoString) return false;
  const dateObj = new Date(isoString);
  return getColombiaDateString(dateObj) < colombiaDateStr;
};

export const getColombiaStartOfDayUTC = (colombiaDateStr: string): string => {
  // colombiaDateStr is 'YYYY-MM-DD'
  // Colombia is UTC-5, so 00:00:00 in Colombia is 05:00:00 in UTC
  return `${colombiaDateStr}T05:00:00.000Z`;
};

export const getColombiaEndOfDayUTC = (colombiaDateStr: string): string => {
  // End of day in Colombia is 23:59:59.999, which is 04:59:59.999 the next day in UTC
  const [year, month, day] = colombiaDateStr.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + 1));
  const nextYear = date.getUTCFullYear();
  const nextMonth = String(date.getUTCMonth() + 1).padStart(2, '0');
  const nextDay = String(date.getUTCDate()).padStart(2, '0');
  return `${nextYear}-${nextMonth}-${nextDay}T04:59:59.999Z`;
};

export const getFirstDayOfColombiaMonth = (): string => {
  const dateStr = new Date().toLocaleString("en-US", { timeZone: "America/Bogota" });
  const colDate = new Date(dateStr);
  
  const year = colDate.getFullYear();
  const month = String(colDate.getMonth() + 1).padStart(2, '0');
  
  return `${year}-${month}-01`;
};
