import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { format, formatDistanceToNow } from "date-fns"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Formats a listing's created_at timestamp for display.
 * Returns null for missing/invalid input so callers can skip rendering.
 */
export function formatPostedDate(createdAt: string | undefined | null): { relative: string; absolute: string } | null {
  if (!createdAt) return null
  const date = new Date(createdAt)
  if (isNaN(date.getTime())) return null
  return {
    relative: formatDistanceToNow(date, { addSuffix: true }),
    absolute: format(date, "MMM d, yyyy"),
  }
}
