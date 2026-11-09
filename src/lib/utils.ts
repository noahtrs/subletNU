import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { format } from "date-fns"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Today's date as "YYYY-MM-DD" in the viewer's local timezone.
const todayKey = (now: Date) => format(now, "yyyy-MM-dd")

/**
 * A sublet is expired once its end date is before today (it stays live
 * through its last day). We compare the "YYYY-MM-DD" prefix of the stored
 * value instead of parsing it with `new Date()`, which treats a bare date as
 * UTC midnight and would shift it to the previous day in US timezones.
 */
export function isSubletExpired(endDate: string | null | undefined, now: Date = new Date()): boolean {
  const endKey = endDate?.slice(0, 10)
  if (!endKey || !/^\d{4}-\d{2}-\d{2}$/.test(endKey)) return false
  return endKey < todayKey(now)
}

/**
 * "May 1 - Aug 31" for dates in the current year; includes the year when
 * either date falls outside it so old listings aren't mistaken for current ones.
 */
export function formatSubletDateRange(startDate: string, endDate: string, now: Date = new Date()): string {
  const start = new Date(startDate)
  const end = new Date(endDate)
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return ""
  const currentYear = now.getFullYear()
  if (start.getFullYear() === currentYear && end.getFullYear() === currentYear) {
    return `${format(start, "MMM d")} - ${format(end, "MMM d")}`
  }
  if (start.getFullYear() === end.getFullYear()) {
    return `${format(start, "MMM d")} - ${format(end, "MMM d, yyyy")}`
  }
  return `${format(start, "MMM d, yyyy")} - ${format(end, "MMM d, yyyy")}`
}
